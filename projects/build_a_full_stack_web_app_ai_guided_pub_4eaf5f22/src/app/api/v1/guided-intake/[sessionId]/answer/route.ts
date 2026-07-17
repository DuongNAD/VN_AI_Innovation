import { handleRoute, AppError, jsonOk } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { readJsonBody, requireString, optionalString } from '@/lib/http';
import { requireSessionToken } from '@/lib/auth';
import { buildIdempotencyKey, withIdempotency } from '@/lib/idempotency';
import { getProvider } from '@/lib/data-provider';
import { validateAnswer, pruneAnswers, computeQuestionFlow } from '@/lib/intake-machine';
import { prisma } from '@/lib/db';

export const POST = handleRoute(async (req: Request, { params }: { params: Promise<{ sessionId: string }> }) => {
  const { sessionId } = await params;
  enforceRateLimit('intake-answer', req);

  // Load session by ID
  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new AppError(404, 'SESSION_NOT_FOUND', 'Không tìm thấy phiên giao dịch.');
  }

  // Check if session has expired
  if (session.expiresAt.getTime() < Date.now()) {
    throw new AppError(404, 'SESSION_EXPIRED', 'Phiên giao dịch đã hết hạn.');
  }

  // Authorize session token
  requireSessionToken(req, session.accessTokenHash);

  // Read request body
  const body = await readJsonBody(req);
  const questionCode = requireString(body, 'questionCode', 1000);
  const value = body.value;
  if (value === undefined) {
    throw new AppError(400, 'INVALID_INPUT', 'Thiếu giá trị câu trả lời.', { field: 'value' });
  }
  const messageId = optionalString(body, 'messageId', 1000);

  // Build idempotency key
  const key = buildIdempotencyKey({
    operation: 'intake-answer',
    resourceId: sessionId,
    sessionId,
    messageId,
    body: { questionCode, value },
  });

  let attempts = 0;
  const maxAttempts = 3;

  while (true) {
    attempts++;
    try {
      const result = await withIdempotency(sessionId, key, async (tx) => {
        // Re-read session inside transaction
        const fresh = await tx.session.findUnique({
          where: { id: sessionId },
        });

        if (!fresh) {
          throw new AppError(404, 'SESSION_NOT_FOUND', 'Không tìm thấy phiên giao dịch.');
        }

        // Get procedure to fetch clarifying questions
        const procedure = await tx.procedure.findUnique({
          where: { code: fresh.procedureCode },
          select: { id: true },
        });

        if (!procedure) {
          throw new AppError(404, 'PROCEDURE_NOT_FOUND', 'Không tìm thấy thủ tục.');
        }

        const provider = getProvider();
        const questions = await provider.getClarifyingQuestions(procedure.id);

        const q = questions.find((question) => question.code === questionCode);
        if (!q) {
          throw new AppError(400, 'UNKNOWN_QUESTION', 'Câu hỏi không tồn tại trong thủ tục này.');
        }

        const stored = validateAnswer(q, value);
        const freshAnswers = (fresh.answersJson as Record<string, unknown>) || {};
        const merged = { ...freshAnswers, [questionCode]: stored };
        const pruned = pruneAnswers(questions, merged);

        const flow = computeQuestionFlow(questions, pruned.answers);

        const updateResult = await tx.session.updateMany({
          where: {
            id: sessionId,
            updatedAt: fresh.updatedAt,
          },
          data: {
            answersJson: pruned.answers as any,
            currentStep: flow.answered,
          },
        });

        if (updateResult.count === 0) {
          throw new AppError(409, 'CONCURRENT_UPDATE', 'Đã xảy ra xung đột khi cập nhật dữ liệu. Vui lòng thử lại.');
        }

        return {
          status: 200,
          body: {
            done: flow.next === null,
            question: flow.next,
            progress: {
              answered: flow.answered,
              total: flow.total,
            },
            removedAnswers: pruned.removed,
          },
        };
      });

      const headers: Record<string, string> = {};
      if (result.replayed) {
        headers['X-Idempotent-Replay'] = 'true';
      }

      return jsonOk(result.body, {
        status: result.status,
        headers,
      });

    } catch (err: any) {
      if (err instanceof AppError && err.code === 'CONCURRENT_UPDATE') {
        if (attempts < maxAttempts) {
          continue;
        }
      }
      throw err;
    }
  }
});