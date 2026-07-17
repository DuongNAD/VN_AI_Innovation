import { prisma } from '@/lib/db';
import { getProvider } from '@/lib/data-provider';
import { AppError, jsonOk, handleRoute } from '@/lib/errors';
import { requireSessionToken } from '@/lib/auth';
import { enforceRateLimit } from '@/lib/rate-limit';
import { compareVersions } from '@/lib/form-migration';
import { sanitizeFormData } from '@/lib/rule-engine';
import { readJsonBody } from '@/lib/http';

async function getValidatedApplicationAndSession(id: string, req: Request) {
  const application = await prisma.application.findUnique({
    where: { id },
    include: { session: true },
  });

  if (!application || !application.session) {
    throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Không tìm thấy hồ sơ.');
  }

  const provider = getProvider();
  const pinned = await provider.getFormVersionById(application.formVersionId);
  if (!pinned) {
    throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Không tìm thấy hồ sơ.');
  }

  if (application.session.expiresAt.getTime() < Date.now()) {
    throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Không tìm thấy hồ sơ.');
  }

  try {
    requireSessionToken(req, application.session.accessTokenHash);
  } catch (err) {
    throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Không tìm thấy hồ sơ.');
  }

  return { application, session: application.session, pinned };
}

export const GET = handleRoute(async (req: Request, { params }: { params: { id: string } }) => {
  enforceRateLimit('applications-id', req);

  const { application, pinned } = await getValidatedApplicationAndSession(params.id, req);
  const formCode = pinned.formCode;

  const provider = getProvider();
  const procedure = await provider.getProcedure(formCode);
  if (!procedure) {
    throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Không tìm thấy hồ sơ.');
  }

  const rules = await provider.getValidationRules(pinned.id);

  const newer = await provider.getActiveFormVersion(formCode);
  const updateAvailable = !!newer && compareVersions(newer.version, pinned.version) > 0;

  const responseBody: any = {
    applicationId: application.id,
    formCode,
    formVersion: pinned.version,
    status: application.status,
    data: application.dataJson,
    revision: application.revision,
    fields: pinned.fields,
    rules,
    updateAvailable,
    procedure: {
      name: procedure.name,
      sourceUrl: procedure.sourceUrl,
      lastCheckedAt: procedure.lastCheckedAt,
    },
  };

  if (updateAvailable && newer) {
    responseBody.newVersion = newer.version;
  }

  return jsonOk(responseBody);
});

export const PUT = handleRoute(async (req: Request, { params }: { params: { id: string } }) => {
  enforceRateLimit('applications-id', req);

  const { application, pinned } = await getValidatedApplicationAndSession(params.id, req);
  const formCode = pinned.formCode;

  // FIX 1a status gate
  if (application.status !== 'DRAFT') {
    throw new AppError(
      409,
      'APPLICATION_NOT_EDITABLE',
      'Hồ sơ không còn ở trạng thái nháp nên không thể chỉnh sửa.'
    );
  }

  let body: any;
  try {
    body = await readJsonBody(req);
  } catch (err: any) {
    throw new AppError(400, 'INVALID_FORM_DATA', 'Dữ liệu không hợp lệ.', {
      issues: [{ path: 'body', message: err.message || 'Cấu trúc JSON không hợp lệ.' }],
    });
  }

  const data = body.data;
  if (data === undefined || typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new AppError(400, 'INVALID_FORM_DATA', 'Dữ liệu không hợp lệ.', {
      issues: [{ path: 'data', message: 'Data must be a plain object.' }],
    });
  }

  const revision = body.revision;
  if (
    typeof revision !== 'number' ||
    !Number.isSafeInteger(revision) ||
    revision < 0 ||
    revision > 2147483646
  ) {
    throw new AppError(400, 'INVALID_FORM_DATA', 'Dữ liệu không hợp lệ.', {
      issues: [{ path: 'revision', message: 'Revision must be an integer between 0 and 2147483646' }],
    });
  }

  const sanitizeResult = sanitizeFormData(pinned.fields, data);
  if (!sanitizeResult.ok) {
    throw new AppError(400, 'INVALID_FORM_DATA', 'Dữ liệu biểu mẫu không hợp lệ.', {
      issues: sanitizeResult.issues.map(issue => ({
        path: issue.field,
        field: issue.field,
        code: issue.code,
        message: `Trường ${issue.field} không hợp lệ.`,
      })),
    });
  }
  const sanitized = sanitizeResult.sanitized;

  const updateResult = await prisma.application.updateMany({
    where: {
      id: application.id,
      revision: revision,
      status: 'DRAFT',
    },
    data: {
      dataJson: sanitized as any,
      revision: revision + 1,
    },
  });

  if (updateResult.count === 0) {
    throw new AppError(
      409,
      'CONCURRENT_UPDATE',
      'Dữ liệu đã được thay đổi ở nơi khác. Vui lòng tải lại.'
    );
  }

  return jsonOk({
    applicationId: application.id,
    formCode,
    formVersion: pinned.version,
    status: application.status,
    data: sanitized,
    revision: revision + 1,
  });
});