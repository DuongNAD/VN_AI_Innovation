import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { getProvider } from '@/lib/data-provider';
import { AppError, jsonOk, handleRoute } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { sanitizeFormData, runRules } from '@/lib/rule-engine';
import { loadOwnedApplication, EDITABLE_STATUSES } from '@/lib/application-access';
import { SIGNED_DECLARATION_FIELD_ID } from '@/lib/application-attachments';
import { documentCheckAllowsSubmission } from '@/lib/ai/document-check';

/**
 * Citizen hands the application over to the receiving agency. The rule engine
 * runs once more on the stored data so an application with blocking errors can
 * never enter the review queue, no matter what the client claimed.
 */
export const POST = handleRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  enforceRateLimit('applications-id', req);

  const { id } = await params;
  const { application, pinned, session } = await loadOwnedApplication(id, req);

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

  // Tên tệp trong dataJson phải khớp một bản ghi đính kèm còn tồn tại — nếu
  // người dân đã bấm "Xóa" tệp rồi nộp mà không lưu lại, cán bộ sẽ mở hồ sơ
  // có tham chiếu tệp rỗng.
  const sanitized = sanitizeResult.sanitized;
  const populatedFileFields = pinned.fields.filter((field) => {
    const value = sanitized[field.id];
    return field.type === 'file' && typeof value === 'string' && value !== '';
  });
  if (populatedFileFields.length > 0) {
    const attachments = await prisma.applicationAttachment.findMany({
      where: {
        applicationId: application.id,
        fieldId: { in: populatedFileFields.map((field) => field.id) },
      },
      select: { fieldId: true, fileName: true, checkJson: true },
    });
    const attachmentByField = new Map(attachments.map((attachment) => [
      attachment.fieldId,
      attachment,
    ]));
    const missingFileFields = populatedFileFields.filter(
      (field) => attachmentByField.get(field.id)?.fileName !== sanitized[field.id]
    );
    if (missingFileFields.length > 0) {
      throw new AppError(422, 'VALIDATION_FAILED', 'Một số tệp đính kèm đã bị xóa hoặc chưa tải lên. Vui lòng mở lại biểu mẫu để cập nhật.', {
        errors: missingFileFields.map((field) => ({
          code: 'ATTACHMENT_NOT_UPLOADED',
          field: field.id,
          message: `Tệp tại trường ${field.label} không còn trên hệ thống.`,
          suggestion: 'Quay lại biểu mẫu, tải lại tệp và lưu trước khi nộp.',
          severity: 'error',
        })),
      });
    }
    const uncheckedFileFields = populatedFileFields.filter((field) => {
      const attachment = attachmentByField.get(field.id);
      return attachment && !documentCheckAllowsSubmission(attachment.checkJson);
    });
    if (uncheckedFileFields.length > 0) {
      throw new AppError(
        422,
        'ATTACHMENT_CHECK_REQUIRED',
        'Một số giấy tờ chưa được kiểm tra nội dung. Vui lòng tải lại đúng tài liệu trước khi nộp.',
        {
          errors: uncheckedFileFields.map((field) => ({
            code: 'ATTACHMENT_CHECK_REQUIRED',
            field: field.id,
            message: `${field.label} chưa được xác nhận đúng loại giấy tờ.`,
            suggestion: 'Tải lại tệp rõ nét và chờ hệ thống kiểm tra nội dung hoàn tất.',
            severity: 'error',
          })),
        }
      );
    }
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
          select: { id: true, checkJson: true },
        });
        if (!signed) {
          throw new AppError(
            422,
            'SIGNATURE_REQUIRED',
            'Vui lòng tải lên tờ khai đã ký trước khi nộp hồ sơ.'
          );
        }
        if (!documentCheckAllowsSubmission(signed.checkJson)) {
          throw new AppError(
            422,
            'SIGNATURE_CHECK_REQUIRED',
            'Tờ khai đã tải lên chưa được kiểm tra nội dung. Vui lòng tải lại tờ khai đã ký; hệ thống chỉ cho nộp sau khi đã kiểm tra đúng loại giấy tờ và chữ ký.'
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

  // Giữ phiên sống tối thiểu 7 ngày sau khi nộp: quyền xem hồ sơ gắn với
  // token phiên ẩn danh, nếu phiên hết hạn trước khi cán bộ duyệt thì người
  // dân không còn cách nào xem kết quả/ghi chú trả lại.
  const minExpiry = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  if (session.expiresAt.getTime() < minExpiry.getTime()) {
    await prisma.session.update({
      where: { id: session.id },
      data: { expiresAt: minExpiry },
    });
  }

  return jsonOk({
    applicationId: application.id,
    formCode: pinned.formCode,
    formVersion: pinned.version,
    status: 'SUBMITTED',
    submittedAt: now,
  });
});
