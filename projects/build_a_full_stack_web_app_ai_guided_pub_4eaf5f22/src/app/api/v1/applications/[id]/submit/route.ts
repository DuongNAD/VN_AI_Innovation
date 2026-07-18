import { prisma } from '@/lib/db';
import { getProvider } from '@/lib/data-provider';
import { AppError, jsonOk, handleRoute } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { sanitizeFormData, runRules } from '@/lib/rule-engine';
import { loadOwnedApplication, EDITABLE_STATUSES } from '@/lib/application-access';
import { readJsonBody } from '@/lib/http';
import {
  getDocumentTypeMeta,
  inferDocumentType,
  parseDocumentTypeInput,
  type DocumentTypeCode,
} from '@/lib/document-types';

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

  // Optional JSON body: { documentType } — required classification for the queue.
  let body: Record<string, unknown> = {};
  try {
    const raw = await readJsonBody(req);
    if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
      body = raw as Record<string, unknown>;
    }
  } catch {
    body = {};
  }

  let documentType: DocumentTypeCode =
    (application.documentType && parseDocumentTypeInput(application.documentType)) ||
    inferDocumentType(pinned.formCode);

  if (body.documentType !== undefined && body.documentType !== null && body.documentType !== '') {
    const parsed = parseDocumentTypeInput(body.documentType);
    if (!parsed) {
      throw new AppError(400, 'INVALID_INPUT', 'Vui lòng chọn loại đơn hợp lệ trước khi nộp.', {
        field: 'documentType',
      });
    }
    documentType = parsed;
  }

  if (!documentType) {
    throw new AppError(400, 'INVALID_INPUT', 'Vui lòng chọn loại đơn trước khi nộp hồ sơ.', {
      field: 'documentType',
    });
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
  // Revision in the claim closes the race with a concurrent save: whatever was
  // validated above is exactly what enters the review queue.
  const updateResult = await prisma.application.updateMany({
    where: {
      id: application.id,
      revision: application.revision,
      status: { in: [...EDITABLE_STATUSES] },
    },
    data: {
      status: 'SUBMITTED',
      documentType,
      submittedAt: now,
      reviewedAt: null,
      reviewedBy: null,
      reviewNote: null,
    },
  });

  if (updateResult.count === 0) {
    throw new AppError(409, 'CONCURRENT_UPDATE', 'Hồ sơ vừa thay đổi ở nơi khác. Vui lòng tải lại và thử lại.');
  }

  const meta = getDocumentTypeMeta(documentType);
  return jsonOk({
    applicationId: application.id,
    formCode: pinned.formCode,
    formVersion: pinned.version,
    documentType,
    documentTypeLabel: meta.label,
    status: 'SUBMITTED',
    submittedAt: now,
  });
});
