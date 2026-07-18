import { requireStaffAuth } from '@/lib/login-auth';
import { prisma } from '@/lib/db';
import { getProvider } from '@/lib/data-provider';
import { AppError, handleRoute, jsonOk } from '@/lib/errors';
import {
  getDocumentTypeMeta,
  inferDocumentType,
  isDocumentTypeCode,
} from '@/lib/document-types';

/**
 * Staff detail for a single citizen application in the officer queue.
 */
export const GET = handleRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  await requireStaffAuth(req, 'manager');

  const { id } = await params;
  if (!id || id.length > 64) {
    throw new AppError(400, 'INVALID_INPUT', 'Mã hồ sơ không hợp lệ.');
  }

  const row = await prisma.application.findUnique({ where: { id } });
  if (!row) {
    throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Không tìm thấy hồ sơ.');
  }
  if (!['SUBMITTED', 'APPROVED', 'RETURNED'].includes(row.status)) {
    throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Không tìm thấy hồ sơ trong hàng chờ.');
  }

  const provider = getProvider();
  const pinned = await provider.getFormVersionById(row.formVersionId);
  if (!pinned) {
    throw new AppError(404, 'APPLICATION_NOT_FOUND', 'Không tìm thấy phiên bản biểu mẫu của hồ sơ.');
  }

  let procedureName = pinned.formCode;
  try {
    const procedure = await provider.getProcedure(pinned.formCode);
    if (procedure?.name) procedureName = procedure.name;
  } catch {
    const form = await prisma.form.findUnique({
      where: { code: pinned.formCode },
      include: { procedure: true },
    });
    procedureName = form?.name || form?.procedure?.name || pinned.formCode;
  }

  const documentType =
    row.documentType && isDocumentTypeCode(row.documentType)
      ? row.documentType
      : inferDocumentType(pinned.formCode);
  const meta = getDocumentTypeMeta(documentType);

  return jsonOk({
    application: {
      id: row.id,
      status: row.status,
      submittedAt: row.submittedAt,
      reviewedAt: row.reviewedAt,
      reviewedBy: row.reviewedBy,
      reviewNote: row.reviewNote,
      formCode: pinned.formCode,
      formVersion: pinned.version,
      procedureName,
      documentType,
      documentTypeLabel: meta.label,
      documentTypeIcon: meta.icon,
      data: row.dataJson,
      fields: pinned.fields,
    },
  });
});
