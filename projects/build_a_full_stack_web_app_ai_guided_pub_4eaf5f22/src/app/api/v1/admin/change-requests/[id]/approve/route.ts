import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { AppError, handleRoute, jsonOk } from '@/lib/errors';
import { activateVersion } from '@/lib/form-migration';

export const POST = handleRoute(async (req: Request, { params }: { params: { id: string } }) => {
  requireAdmin(req);

  const id = params.id;
  const now = new Date();

  const responseBody = await prisma.$transaction(async (tx) => {
    // (1) CLAIM:
    const updateResult = await tx.changeRequest.updateMany({
      where: { id, status: 'PENDING' },
      data: {
        status: 'APPROVED',
        reviewedBy: 'shared-admin-token',
        reviewedAt: now,
      },
    });

    if (updateResult.count === 0) {
      const existing = await tx.changeRequest.findUnique({
        where: { id },
      });
      if (existing) {
        throw new AppError(409, 'ALREADY_PROCESSED', 'Đã xử lý trước đó.');
      } else {
        throw new AppError(404, 'CHANGE_REQUEST_NOT_FOUND', 'Không tìm thấy yêu cầu thay đổi.');
      }
    }

    // (2) Load the CR
    const cr = await tx.changeRequest.findUnique({
      where: { id },
      include: {
        oldVersion: {
          include: {
            form: true,
          },
        },
      },
    });

    if (!cr || !cr.oldVersion || !cr.oldVersion.form) {
      throw new AppError(404, 'CHANGE_REQUEST_NOT_FOUND', 'Không tìm thấy yêu cầu thay đổi.');
    }

    const form = cr.oldVersion.form;
    const proposedData = cr.proposedDataJson as any;
    const targetVersion = proposedData?.targetVersion;
    if (!targetVersion || typeof targetVersion !== 'string') {
      throw new AppError(400, 'INVALID_TARGET_VERSION', 'Phiên bản đích không hợp lệ.');
    }

    // (3) PER-FORM SERIALIZATION:
    const formId = form.id;
    const formState = await tx.form.findUnique({
      where: { id: formId },
    });
    if (!formState) {
      throw new AppError(404, 'FORM_NOT_FOUND', 'Không tìm thấy biểu mẫu.');
    }

    const revision = formState.revision;
    const formUpdateResult = await tx.form.updateMany({
      where: { id: formId, revision },
      data: { revision: revision + 1 },
    });

    if (formUpdateResult.count === 0) {
      throw new AppError(409, 'CONCURRENT_UPDATE', 'Đang có thao tác khác, thử lại.');
    }

    // (4) RE-READ all FormVersions:
    const versions = await tx.formVersion.findMany({
      where: { formId },
    });

    // (5) activateVersion:
    const result = activateVersion(versions, targetVersion, now);

    // (6) persist each changed row:
    for (const v of result.changed) {
      await tx.formVersion.update({
        where: { id: v.id },
        data: {
          status: v.status,
          effectiveFrom: v.effectiveFrom,
          effectiveTo: v.effectiveTo,
        },
      });
    }

    // (7) INVARIANT:
    const activeCount = await tx.formVersion.count({
      where: {
        formId,
        status: 'ACTIVE',
      },
    });

    if (activeCount !== 1) {
      throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.');
    }

    return {
      changeRequestId: id,
      status: 'APPROVED',
      formCode: form.code,
      activatedVersion: result.target.version,
      closedVersion: result.closed ? result.closed.version : null,
      effectiveFrom: result.target.effectiveFrom,
    };
  });

  return jsonOk(responseBody);
});