import { handleRoute, AppError, jsonOk } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getProvider } from '@/lib/data-provider';

export const GET = handleRoute(async (req: Request, { params }: { params: { formCode: string } }) => {
  enforceRateLimit('forms-active', req);

  const { formCode } = params;
  const provider = getProvider();
  const v = await provider.getActiveFormVersion(formCode);

  if (!v) {
    throw new AppError(404, 'FORM_NOT_FOUND', 'Không tìm thấy biểu mẫu hoạt động.');
  }

  return jsonOk({
    formCode,
    version: v.version,
    effectiveFrom: v.effectiveFrom,
    fields: v.fields,
  });
});