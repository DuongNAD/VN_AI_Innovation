import { Prisma } from '@prisma/client';
import { handleRoute, AppError, jsonOk } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { requireSessionToken } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { readJsonBody } from '@/lib/http';
import { getProvider } from '@/lib/data-provider';
import { compareVersions, computeMigration } from '@/lib/form-migration';
import { parseFieldDefs, parseMigrationHints } from '@/lib/schema-guards';
import { sanitizeFormData } from '@/lib/rule-engine';

function parseMigrateBody(raw: unknown): { confirm: boolean; resolutions: Record<string, string> } {
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

function requireDraft(status: string): void {
  if (status !== 'DRAFT') {
    throw new AppError(
      409,
      'APPLICATION_NOT_DRAFT',
      'Chỉ có thể cập nhật biểu mẫu cho hồ sơ ở trạng thái nháp.'
    );
  }
}

function parseFormSchema(schemaJson: unknown) {
  const schema =
    schemaJson && typeof schemaJson === 'object' && !Array.isArray(schemaJson)
      ? (schemaJson as Record<string, unknown>)
      : {};

  return {
    fields: parseFieldDefs(schema.fields),
    migrationHints: parseMigrationHints(schema.migrationHints ?? []),
  };
}

function noNewerVersion(): never {
  throw new AppError(409, 'NO_NEWER_VERSION', 'Không có phiên bản biểu mẫu mới hơn.');
}

function concurrentUpdate(): never {
  throw new AppError(
    409,
    'CONCURRENT_UPDATE',
    'Dữ liệu đã được thay đổi ở nơi khác. Vui lòng tải lại.'
  );
}

export const POST = handleRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  enforceRateLimit('migrate', req);

  const { id } = await params;

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

  requireDraft(application.status);

  const provider = getProvider();
  const pinned = await provider.getFormVersionById(application.formVersionId);
  if (!pinned) {
    throw new AppError(404, 'FORM_VERSION_NOT_FOUND', 'Không tìm thấy phiên bản biểu mẫu hiện tại.');
  }

  const formCode = pinned.formCode;

  const active = await provider.getActiveFormVersion(formCode);
  if (
    !active ||
    active.id === pinned.id ||
    compareVersions(active.version, pinned.version) <= 0
  ) {
    noNewerVersion();
  }

  const rawBody = req.body === null ? {} : await readJsonBody(req);
  const { confirm, resolutions } = parseMigrateBody(rawBody);

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

  let commitResult: {
    fromVersion: string;
    toVersion: string;
    migrated: string[];
    applied: { from: string; to: string }[];
    dropped: string[];
    revision: number;
  };

  try {
    commitResult = await prisma.$transaction(
      async (tx) => {
        const fresh = await tx.application.findUnique({
          where: { id },
          include: {
            session: true,
            formVersion: {
              include: { form: true },
            },
          },
        });

        if (!fresh || !fresh.session || !fresh.formVersion) {
          throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Không tìm thấy hồ sơ đăng ký.');
        }

        try {
          requireSessionToken(req, fresh.session.accessTokenHash, fresh.session.expiresAt);
        } catch (err) {
          throw new AppError(401, 'APPLICATION_NOT_FOUND', 'Không tìm thấy hồ sơ đăng ký.');
        }

        requireDraft(fresh.status);
        if (
          fresh.formVersionId !== application.formVersionId ||
          fresh.revision !== application.revision
        ) {
          concurrentUpdate();
        }

        const now = new Date();
        const activeVersions = await tx.formVersion.findMany({
          where: {
            formId: fresh.formVersion.formId,
            status: 'ACTIVE',
            effectiveFrom: { lte: now },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: now } }],
          },
          take: 2,
        });

        if (activeVersions.length === 0) {
          noNewerVersion();
        }
        if (activeVersions.length > 1) {
          throw new AppError(
            500,
            'DATA_INTEGRITY',
            'Dữ liệu phiên bản biểu mẫu không nhất quán.'
          );
        }

        const target = activeVersions[0];
        if (
          target.id === fresh.formVersion.id ||
          compareVersions(target.version, fresh.formVersion.version) <= 0
        ) {
          noNewerVersion();
        }

        const sourceSchema = parseFormSchema(fresh.formVersion.schemaJson);
        const targetSchema = parseFormSchema(target.schemaJson);
        const freshData =
          fresh.dataJson &&
          typeof fresh.dataJson === 'object' &&
          !Array.isArray(fresh.dataJson)
            ? (fresh.dataJson as Record<string, unknown>)
            : {};

        const result = computeMigration(
          sourceSchema.fields,
          targetSchema.fields,
          targetSchema.migrationHints,
          freshData,
          resolutions
        );

        if (result.needsConfirmation.length > 0) {
          throw new AppError(
            400,
            'MISSING_RESOLUTION',
            'Cần xác nhận lựa chọn chuyển đổi dữ liệu.',
            {
              unresolved: result.needsConfirmation.map((item) => item.from),
            }
          );
        }

        const sanitized = sanitizeFormData(targetSchema.fields, result.migratedData);
        if (!sanitized.ok) {
          throw new AppError(
            400,
            'INVALID_FORM_DATA',
            'Dữ liệu biểu mẫu sau chuyển đổi không hợp lệ.',
            { issues: sanitized.issues }
          );
        }

        const updateResult = await tx.application.updateMany({
          where: {
            id,
            revision: fresh.revision,
            formVersionId: fresh.formVersionId,
            status: 'DRAFT',
          },
          data: {
            formVersionId: target.id,
            dataJson: sanitized.sanitized as Prisma.InputJsonValue,
            revision: fresh.revision + 1,
          },
        });

        if (updateResult.count === 0) {
          concurrentUpdate();
        }

        return {
          fromVersion: fresh.formVersion.version,
          toVersion: target.version,
          migrated: result.migrated,
          applied: result.applied,
          dropped: result.dropped,
          revision: fresh.revision + 1,
        };
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2034'
    ) {
      concurrentUpdate();
    }
    throw error;
  }

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
