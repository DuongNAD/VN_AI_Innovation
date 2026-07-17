import { handleRoute, AppError, jsonOk } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { requireSessionToken, sha256hex } from '@/lib/auth';
import { getProvider } from '@/lib/data-provider';
import { pruneAnswers, buildGuidance } from '@/lib/intake-machine';
import { cachedJson } from '@/lib/cache';
import { canonicalJson } from '@/lib/idempotency';
import { prisma } from '@/lib/db';

export const GET = handleRoute(async (req: Request, { params }: { params: Promise<{ sessionId: string }> }) => {
  enforceRateLimit('guidance', req);
  const { sessionId } = await params;

  // Load session (404/expired ordering per conventions)
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new AppError(404, 'SESSION_NOT_FOUND', 'Không tìm thấy phiên giao dịch.');
  }

  const now = new Date();
  if (session.expiresAt.getTime() < now.getTime()) {
    throw new AppError(404, 'SESSION_EXPIRED', 'Phiên giao dịch đã hết hạn.');
  }

  // Token validation
  requireSessionToken(req, session.accessTokenHash);

  // Load procedure
  const provider = getProvider();
  const procedure = await provider.getProcedure(session.procedureCode);
  if (!procedure) {
    throw new AppError(404, 'PROCEDURE_NOT_FOUND', 'Không tìm thấy thủ tục.');
  }

  // Load procedure ID from DB to query active version and documents
  const procRow = await prisma.procedure.findUnique({
    where: { code: session.procedureCode },
    select: { id: true },
  });
  if (!procRow) {
    throw new AppError(404, 'PROCEDURE_NOT_FOUND', 'Không tìm thấy thủ tục.');
  }

  // Load active procedure version
  const procVersion = await provider.getActiveProcedureVersion(procRow.id);
  if (!procVersion) {
    throw new AppError(404, 'PROCEDURE_NOT_FOUND', 'Không tìm thấy phiên bản hoạt động cho thủ tục.');
  }

  // Load documents and questions
  const documents = await provider.getDocuments(procRow.id);
  const questions = await provider.getClarifyingQuestions(procRow.id);

  // Prune answers based on question state machine rules
  const sessionAnswers = (session.answersJson && typeof session.answersJson === 'object' && !Array.isArray(session.answersJson))
    ? (session.answersJson as Record<string, unknown>)
    : {};
  const { answers } = pruneAnswers(questions, sessionAnswers);

  // The cached payload embeds formAvailable, so the key must change when the
  // active form version changes (e.g. right after an admin approval).
  const activeForm = await provider.getActiveFormVersion(procedure.code);
  const formAvailable = activeForm !== null;

  // Generate cache key
  const answersHash = sha256hex(canonicalJson(answers));
  const key = `guidance:${procedure.code}:${procVersion.version}:${activeForm?.version ?? 'none'}:${answersHash}:vi`;

  // Get guidance from cache or compute it
  const { value, cacheHit } = await cachedJson(key, 300, async () => {
    const baseGuidance = buildGuidance({
      procedure,
      procedureVersion: procVersion,
      documents,
      answers,
      questions,
    });

    // Build checklist mapping documents with submission types
    const docMap = new Map(documents.map((d) => [d.code, d]));
    const checklist = baseGuidance.checklist.map((item: any) => {
      const doc = docMap.get(item.code);
      return {
        ...item,
        submissionType: doc ? doc.submissionType : 'SUBMIT',
      };
    });

    // Map steps and carry step examples
    const steps = (baseGuidance.steps || procVersion.stepsJson || []).map((step: any) => ({
      order: step.order,
      title: step.title,
      description: step.description,
      example: step.example || '',
    }));

    return {
      ...baseGuidance,
      legalBasisText: procVersion.legalBasisText || null,
      procedure: {
        ...baseGuidance.procedure,
        legalBasisText: procVersion.legalBasisText || null,
      },
      checklist,
      steps,
      formAvailable,
    };
  });

  return jsonOk({
    ...value,
    meta: {
      cached: cacheHit,
    },
  });
});
