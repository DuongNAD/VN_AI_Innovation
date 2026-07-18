import { handleRoute, AppError, jsonOk } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { readJsonBody, requireString, optionalString, aiMeta } from '@/lib/http';
import { getProvider } from '@/lib/data-provider';
import { requireLiveSession } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sanitizeFormData, runRules } from '@/lib/rule-engine';
import { getLlmProvider, mockLlm } from '@/lib/ai/llm';

export const POST = handleRoute(async (req: Request, { params }: { params: Promise<{ formCode: string }> }) => {
  enforceRateLimit('validate', req);
  const { formCode } = await params;
  const liveSession = await requireLiveSession(req, formCode);

  const body = await readJsonBody(req);
  const formVersion = requireString(body, 'formVersion');

  const rawData = body.data;
  if (typeof rawData !== 'object' || rawData === null || Array.isArray(rawData)) {
    throw new AppError(400, 'INVALID_INPUT', 'Trường dữ liệu không hợp lệ.', { field: 'data' });
  }
  const data = rawData as Record<string, unknown>;

  const applicationId = optionalString(body, 'applicationId');
  const provider = getProvider();
  const requested = await provider.getFormVersion(formCode, formVersion);
  if (!requested) {
    throw new AppError(404, 'FORM_VERSION_NOT_FOUND', 'Không tìm thấy phiên bản biểu mẫu.');
  }

  if (applicationId) {
    const application = await prisma.application.findUnique({
      where: { id: applicationId },
      include: { session: true },
    });

    if (
      !application ||
      !application.session ||
      application.formVersionId !== requested.id ||
      application.sessionId !== liveSession.id
    ) {
      throw new AppError(403, 'VERSION_NOT_ACCESSIBLE', 'Phiên bản biểu mẫu này không khả dụng.');
    }
  } else {
    const active = await provider.getActiveFormVersion(formCode);
    if (!active || requested.id !== active.id) {
      throw new AppError(403, 'VERSION_NOT_ACCESSIBLE', 'Phiên bản biểu mẫu này không khả dụng.');
    }
  }

  const sanitizeResult = sanitizeFormData(requested.fields, data);
  if (!sanitizeResult.ok) {
    throw new AppError(400, 'INVALID_FORM_DATA', 'Dữ liệu biểu mẫu không hợp lệ.', {
      issues: sanitizeResult.issues,
    });
  }
  const sanitized = sanitizeResult.sanitized;

  const rules = await provider.getValidationRules(requested.id);
  const applicableRules = applicationId
    ? rules
    : rules.filter(
        (rule) =>
          rule.type !== 'required' ||
          typeof rule.fieldId !== 'string' ||
          Object.prototype.hasOwnProperty.call(sanitized, rule.fieldId)
      );
  const errors = runRules(requested.fields, applicableRules, sanitized);

  let aiExplanation: string | undefined;
  const currentLlmProvider = getLlmProvider();
  let aiMode = currentLlmProvider.name;
  let degraded = false;

  if (errors.length > 0) {
    const reduced = errors.map(err => ({
      code: err.code,
      field: err.field,
      fields: err.fields,
    }));

    try {
      aiExplanation = await currentLlmProvider.explainErrors(reduced, formCode);
    } catch (err) {
      degraded = true;
      aiMode = 'mock';
      aiExplanation = await mockLlm.explainErrors(reduced, formCode);
    }
  }

  return jsonOk({
    valid: errors.length === 0,
    errors,
    ...(errors.length > 0 ? { aiExplanation } : {}),
    formCode,
    formVersion,
    ...aiMeta(aiMode, degraded),
  });
});
