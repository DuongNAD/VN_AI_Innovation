import { enforceRateLimit } from '@/lib/rate-limit';
import { readJsonBody, requireString, optionalString } from '@/lib/http';
import { prisma } from '@/lib/db';
import { AppError, handleRoute, jsonOk } from '@/lib/errors';
import { requireSessionToken } from '@/lib/auth';
import { getProvider } from '@/lib/data-provider';
import { sanitizeFormData } from '@/lib/rule-engine';
import { buildIdempotencyKey, withIdempotency } from '@/lib/idempotency';
import { getAuthUserFromRequest } from '@/lib/login-auth';

export const POST = handleRoute(async (req: Request) => {
  enforceRateLimit('applications', req);

  const body = await readJsonBody(req);
  const sessionId = requireString(body, 'sessionId');
  const messageId = optionalString(body, 'messageId');

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new AppError(404, 'SESSION_NOT_FOUND', 'Không tìm thấy phiên làm việc.');
  }

  if (session.expiresAt < new Date()) {
    throw new AppError(404, 'SESSION_EXPIRED', 'Phiên làm việc đã hết hạn.');
  }

  requireSessionToken(req, session.accessTokenHash);

  const provider = getProvider();
  const active = await provider.getActiveFormVersion(session.procedureCode);
  if (!active) {
    throw new AppError(404, 'FORM_NOT_FOUND', 'Không tìm thấy biểu mẫu hoạt động cho thủ tục này.');
  }

  const answers = (session.answersJson && typeof session.answersJson === 'object' && !Array.isArray(session.answersJson))
    ? (session.answersJson as Record<string, unknown>)
    : {};

  const activeFieldIds = new Set(active.fields.map((f) => f.id));
  const prePrefillData: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(answers)) {
    if (activeFieldIds.has(key)) {
      prePrefillData[key] = value;
    }
  }

  let prefill: Record<string, unknown> = {};
  const sanitizeResult = sanitizeFormData(active.fields, prePrefillData);
  if (sanitizeResult.ok) {
    prefill = sanitizeResult.sanitized;
  } else {
    const issueFields = new Set(sanitizeResult.issues.map((i) => i.field));
    const cleanedData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(prePrefillData)) {
      if (!issueFields.has(key)) {
        cleanedData[key] = value;
      }
    }
    const retryResult = sanitizeFormData(active.fields, cleanedData);
    if (retryResult.ok) {
      prefill = retryResult.sanitized;
    } else {
      prefill = {};
    }
  }

  // Link the application to the logged-in citizen (if any) so they can reopen it
  // later under "Hồ sơ của tôi"; anonymous guided-intake sessions leave it null.
  const authUser = await getAuthUserFromRequest(req);
  const ownerId = authUser?.role === 'user' ? authUser.id : null;

  const key = buildIdempotencyKey({
    operation: 'application-create',
    resourceId: sessionId,
    sessionId,
    messageId,
    body: {},
  });

  const result = await withIdempotency(sessionId, key, async (tx) => {
    const app = await tx.application.create({
      data: {
        sessionId,
        formVersionId: active.id,
        userId: ownerId,
        status: 'DRAFT',
        dataJson: prefill as any,
      },
    });

    return {
      status: 201,
      body: {
        applicationId: app.id,
        formCode: active.formCode,
        formVersion: active.version,
        status: 'DRAFT',
        data: prefill,
        revision: 0,
      },
    };
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  if (result.replayed) {
    headers['X-Idempotent-Replay'] = 'true';
  }

  return jsonOk(result.body, {
    status: result.status,
    headers,
  });
});