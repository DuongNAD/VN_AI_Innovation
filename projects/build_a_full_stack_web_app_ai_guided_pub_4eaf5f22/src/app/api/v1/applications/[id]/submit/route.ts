import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getProvider } from '@/lib/data-provider';
import { AppError, jsonOk, handleRoute } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { sanitizeFormData, runRules } from '@/lib/rule-engine';
import { loadOwnedApplication, EDITABLE_STATUSES } from '@/lib/application-access';
import { SIGNED_DECLARATION_FIELD_ID } from '@/lib/application-attachments';

/**
 * Citizen hands the application over to the receiving agency. The rule engine
 * runs once more on the stored data so an application with blocking errors can
 * never enter the review queue, no matter what the client claimed.
 */
export const POST = handleRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  enforceRateLimit('applications-id', req);

  const { id } = await params;
  const { application, pinned } = await loadOwnedApplication(id, req);

  if (!(EDITABLE_STATUSES as readonly string[]).includes(application.status)) {
    if (application.status === 'SUBMITTED') {
      throw new AppError(409, 'ALREADY_SUBMITTED', 'Hồ sơ đã được nộp và đang chờ xét duyệt.');
    }
    throw new AppError(409, 'ALREADY_PROCESSED', 'Hồ sơ đã được cán bộ xử lý.');
  }

  const storedData =
    application.dataJson && typeof application.dataJson === 'object' && !Array.isArray(application.dataJson)
      ? (application.dataJson as Record<string, unknown>)
      : {};

  const sanitizeResult = sanitizeFormData(pinned.fields, storedData);
  if (!sanitizeResult.ok) {
    throw new AppError(422, 'VALIDATION_FAILED', 'Hồ sơ còn dữ liệu không hợp lệ, chưa thể nộp.', {
      issues: sanitizeResult.issues,
    });
  }

  const provider = getProvider();
  const rules = await provider.getValidationRules(pinned.id);
  const errors = runRules(pinned.fields, rules, sanitizeResult.sanitized);
  const blocking = errors.filter((e) => e.severity === 'error');
  if (blocking.length > 0) {
    throw new AppError(422, 'VALIDATION_FAILED', 'Hồ sơ còn lỗi cần sửa trước khi nộp.', {
      errors: blocking,
    });
  }

  const now = new Date();
  // A tờ khai must be signed before it reaches the officer: the citizen has to
  // download the generated declaration, sign it (by hand + scan, or digitally)
  // and upload the signed copy. Editing the form or any attachment clears the
  // signed copy, so what is on file always reflects the exact data submitted.
  //
  // The signature check and the status flip run in one serializable transaction
  // so a concurrent DELETE of the signed copy cannot slip an unsigned
  // application into the queue — attachment writes do not bump `revision`, so
  // the revision claim alone would not detect it.
  let updatedCount: number;
  try {
    updatedCount = await prisma.$transaction(
      async (tx) => {
        const signed = await tx.applicationAttachment.findUnique({
          where: {
            applicationId_fieldId: { applicationId: application.id, fieldId: SIGNED_DECLARATION_FIELD_ID },
          },
          select: { id: true },
        });
        if (!signed) {
          throw new AppError(
            422,
            'SIGNATURE_REQUIRED',
            'Vui lòng tải lên tờ khai đã ký trước khi nộp hồ sơ.'
          );
        }
        // Revision in the claim closes the race with a concurrent save: whatever
        // was validated above is exactly what enters the review queue.
        const res = await tx.application.updateMany({
          where: {
            id: application.id,
            revision: application.revision,
            status: { in: [...EDITABLE_STATUSES] },
          },
          data: {
            status: 'SUBMITTED',
            submittedAt: now,
            reviewedAt: null,
            reviewedBy: null,
            reviewNote: null,
          },
        });
        return res.count;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    );
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
      throw new AppError(409, 'CONCURRENT_UPDATE', 'Hồ sơ vừa thay đổi ở nơi khác. Vui lòng tải lại và thử lại.');
    }
    throw err;
  }

  if (updatedCount === 0) {
    throw new AppError(409, 'CONCURRENT_UPDATE', 'Hồ sơ vừa thay đổi ở nơi khác. Vui lòng tải lại và thử lại.');
  }

  return jsonOk({
    applicationId: application.id,
    formCode: pinned.formCode,
    formVersion: pinned.version,
    status: 'SUBMITTED',
    submittedAt: now,
  });
});
