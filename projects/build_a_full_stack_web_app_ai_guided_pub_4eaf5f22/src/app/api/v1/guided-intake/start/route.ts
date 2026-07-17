import { handleRoute, AppError, jsonOk } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { readJsonBody, requireString, optionalObject, optionalString } from '@/lib/http';
import { getProvider } from '@/lib/data-provider';
import { prisma } from '@/lib/db';
import { validateAnswer, pruneAnswers, computeQuestionFlow } from '@/lib/intake-machine';
import { generateAccessToken, hashToken } from '@/lib/auth';
import { getSessionTtlHours } from '@/lib/config';
import { DISCLAIMER } from '@/lib/constants';

export const POST = handleRoute(async (req: Request) => {
  enforceRateLimit('intake-start', req);

  const body = await readJsonBody(req);
  const procedureCode = requireString(body, 'procedureCode');
  const presetAnswers = optionalObject(body, 'presetAnswers');
  const intentMessage = optionalString(body, 'intentMessage', 1000);

  const provider = getProvider();
  const procedure = await provider.getProcedure(procedureCode);
  if (!procedure) {
    throw new AppError(404, 'PROCEDURE_NOT_FOUND', 'Không tìm thấy thủ tục.');
  }

  const procRow = await prisma.procedure.findUnique({
    where: { code: procedureCode },
    select: { id: true },
  });
  if (!procRow) {
    throw new AppError(404, 'PROCEDURE_NOT_FOUND', 'Không tìm thấy thủ tục.');
  }

  const questions = await provider.getClarifyingQuestions(procRow.id);

  const validatedPresets: Record<string, any> = {};
  if (presetAnswers !== undefined) {
    const keys = Object.keys(presetAnswers);
    if (keys.length > 20) {
      throw new AppError(400, 'INVALID_INPUT', 'Số lượng câu trả lời sẵn vượt quá giới hạn.');
    }

    const questionsMap = new Map(questions.map((q) => [q.code, q]));

    for (const key of keys) {
      const q = questionsMap.get(key);
      if (!q) {
        throw new AppError(400, 'UNKNOWN_QUESTION', `Câu hỏi preset không xác định: ${key}`, {
          questionCode: key,
        });
      }
      const val = presetAnswers[key];
      const validatedVal = validateAnswer(q, val);
      validatedPresets[key] = validatedVal;
    }
  }

  const pruned = pruneAnswers(questions, validatedPresets);
  const answers = pruned.answers;

  const token = generateAccessToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + getSessionTtlHours() * 60 * 60 * 1000);

  const session = await prisma.session.create({
    data: {
      accessTokenHash: hashToken(token),
      procedureCode,
      intent: intentMessage ?? null,
      answersJson: answers as any,
      expiresAt,
    },
  });

  const flow = computeQuestionFlow(questions, answers);

  return jsonOk(
    {
      sessionId: session.id,
      accessToken: token,
      procedure: {
        code: procedure.code,
        name: procedure.name,
      },
      done: flow.next === null,
      question: flow.next,
      progress: {
        answered: flow.answered,
        total: flow.total,
      },
      disclaimer: DISCLAIMER,
    },
    { status: 201 }
  );
});