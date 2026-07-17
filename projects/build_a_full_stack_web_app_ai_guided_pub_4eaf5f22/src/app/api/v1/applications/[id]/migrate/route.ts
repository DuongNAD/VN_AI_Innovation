import { handleRoute, AppError, jsonOk } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { requireSessionToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { getProvider } from '@/lib/data-provider';
import { computeMigration } from '@/lib/form-migration';

function parseMigrateBody(bodyText: string): { confirm: boolean; resolutions: Record<string, string> } {
  let raw: any = {};
  if (bodyText.trim() !== '') {
    try {
      raw = JSON.parse(bodyText);
    } catch (err) {
      throw new AppError(400, 'INVALID_FORM_DATA', 'Cấu trúc JSON không hợp lệ.');
    }
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    throw new AppError(400, 'INVALID_FORM_DATA', 'Dữ liệu yêu cầu không hợp lệ.');
  }

  const proto = Object.getPrototypeOf(raw);
  if (proto !== Object.prototype && proto !== null) {
    throw new AppError(400, 'INVALID_FORM_DATA', 'Dữ liệu yêu cầu không hợp lệ.');
  }

  const keys = Object.keys(raw);
  for (const key of keys) {
    if (key !== 'confirm' && key !== 'resolutions') {
      throw new AppError(400, 'INVALID_FORM_DATA', 'Dữ liệu yêu cầu không hợp lệ.');
    }
  }

  let confirm = false;
  if ('confirm' in raw) {
    const rawConfirm = raw.confirm;
    if (typeof rawConfirm !== 'boolean') {
      throw new AppError(400, 'INVALID_FORM_DATA', 'Trường confirm phải là kiểu boolean.');
    }
    confirm = rawConfirm;
  }

  const sanitizedResolutions = Object.create(null);
  if ('resolutions' in raw) {
    const rawResolutions = raw.resolutions;
    if (typeof rawResolutions !== 'object' || rawResolutions === null || Array.isArray(rawResolutions)) {
      throw new AppError(400, 'INVALID_FORM_DATA', 'Trường resolutions phải là đối tượng.');
    }
    const resProto = Object.getPrototypeOf(rawResolutions);
    if (resProto !== Object.prototype && resProto !== null) {
      throw new AppError(400, 'INVALID_FORM_DATA', 'Trường resolutions phải là đối tượng.');
    }

    const entries = Object.entries(rawResolutions);
    if (entries.length > 100) {
      throw new AppError(400, 'INVALID_FORM_DATA', 'Trường resolutions chứa quá nhiều phần tử.');
    }

    const keyValPattern = /^[A-Za-z0-9_]{1,64}$/;

    for (const [key, value] of entries) {
      if (key === '__proto__' || key === 'constructor' || key === 'prototype') {
        throw new AppError(400, 'INVALID_FORM_DATA', 'Tên trường trong resolutions không hợp lệ.');
      }
      if (typeof value !== 'string') {
        throw new AppError(400, 'INVALID_FORM_DATA', 'Giá trị trong resolutions phải là chuỗi.');
      }
      if (value === '__proto__' || value === 'constructor' || value === 'prototype') {
        throw new AppError(400, 'INVALID_FORM_DATA', 'Giá trị trong resolutions không hợp lệ.');
      }

      if (!keyValPattern.test(key) || !keyValPattern.test(value)) {
        throw new AppError(400, 'INVALID_FORM_DATA', 'Lựa chọn giải quyết không hợp lệ.');
      }

      sanitizedResolutions[key] = value;
    }
  }

  return { confirm, resolutions: sanitizedResolutions };
}

export const POST = handleRoute(async (req: Request, { params }: { params: { id: string } }) => {
  enforceRateLimit('migrate', req);

  const { id } = params;

  const application = await prisma.application.findUnique({
    where: { id },
    include: { session: true },
  });

  if (!application || !application.session) {
    throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Không tìm thấy hồ sơ đăng ký.');
  }

  // Full session validation using the extended requireSessionToken helper
  try {
    requireSessionToken(req, application.session.accessTokenHash, application.session.expiresAt);
  } catch (err) {
    throw new AppError(401, 'APPLICATION_NOT_FOUND', 'Không tìm thấy hồ sơ đăng ký.');
  }

  const provider = getProvider();
  const pinned = await provider.getFormVersionById(application.formVersionId);
  if (!pinned) {
    throw new AppError(404, 'FORM_VERSION_NOT_FOUND', 'Không tìm thấy phiên bản biểu mẫu hiện tại.');
  }

  const formCode = pinned.formCode;

  const active = await provider.getActiveFormVersion(formCode);
  if (!active || active.id === pinned.id) {
    throw new AppError(409, 'NO_NEWER_VERSION', 'Không có phiên bản biểu mẫu mới hơn.');
  }

  // Parse and validate request body
  let bodyText = '';
  try {
    bodyText = await req.text();
  } catch (err) {
    throw new AppError(400, 'INVALID_FORM_DATA', 'Không thể đọc nội dung yêu cầu.');
  }

  const { confirm, resolutions } = parseMigrateBody(bodyText);

  const appData = (application.dataJson && typeof application.dataJson === 'object' && !Array.isArray(application.dataJson))
    ? (application.dataJson as Record<string, unknown>)
    : {};

  if (!confirm) {
    const result = computeMigration(
      pinned.fields,
      active.fields,
      active.migrationHints,
      appData,
      undefined
    );

    return jsonOk({
      mode: 'preview',
      fromVersion: pinned.version,
      toVersion: active.version,
      migrated: result.migrated,
      needsConfirmation: result.needsConfirmation,
      dropped: result.dropped,
    });
  }

  const commitResult = await prisma.$transaction(async (tx) => {
    const fresh = await tx.application.findUnique({
      where: { id },
      include: { session: true },
    });

    if (!fresh || !fresh.session) {
      throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Không tìm thấy hồ sơ đăng ký.');
    }

    // Re-assert session validity inside the commit transaction before the write
    try {
      requireSessionToken(req, fresh.session.accessTokenHash, fresh.session.expiresAt);
    } catch (err) {
      throw new AppError(401, 'APPLICATION_NOT_FOUND', 'Không tìm thấy hồ sơ đăng ký.');
    }

    if (fresh.formVersionId !== pinned.id) {
      throw new AppError(409, 'NO_NEWER_VERSION', 'Biểu mẫu đã được cập nhật phiên bản mới.');
    }

    const freshData = (fresh.dataJson && typeof fresh.dataJson === 'object' && !Array.isArray(fresh.dataJson))
      ? (fresh.dataJson as Record<string, unknown>)
      : {};

    const result = computeMigration(
      pinned.fields,
      active.fields,
      active.migrationHints,
      freshData,
      resolutions
    );

    if (result.needsConfirmation.length > 0) {
      throw new AppError(400, 'MISSING_RESOLUTION', 'Cần xác nhận lựa chọn chuyển đổi dữ liệu.', {
        unresolved: result.needsConfirmation.map((item) => item.from),
      });
    }

    const updateResult = await tx.application.updateMany({
      where: {
        id,
        revision: fresh.revision,
      },
      data: {
        formVersionId: active.id,
        dataJson: result.migratedData as any,
        revision: fresh.revision + 1,
      },
    });

    if (updateResult.count === 0) {
      throw new AppError(
        409,
        'CONCURRENT_UPDATE',
        'Dữ liệu đã được thay đổi ở nơi khác. Vui lòng tải lại.'
      );
    }

    return {
      fromVersion: pinned.version,
      toVersion: active.version,
      migrated: result.migrated,
      applied: result.applied,
      dropped: result.dropped,
      revision: fresh.revision + 1,
    };
  });

  return jsonOk({
    mode: 'committed',
    fromVersion: commitResult.fromVersion,
    toVersion: commitResult.toVersion,
    migrated: commitResult.migrated,
    applied: commitResult.applied,
    dropped: commitResult.dropped,
    revision: commitResult.revision,
    message: 'Biểu mẫu đã được cập nhật theo quy định mới.',
  });
});