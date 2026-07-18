import { prisma } from '@/lib/db';
import { AppError, handleRoute, jsonOk } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { loadOwnedApplication, EDITABLE_STATUSES } from '@/lib/application-access';
import { requireStaffRole } from '@/lib/login-auth';
import { STAFF_PERMISSIONS } from '@/lib/roles';
import {
  attachmentContentDisposition,
  detectSafeAttachmentMime,
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_REQUEST_BYTES,
  sanitizeAttachmentFileName,
} from '@/lib/application-attachments';

const FIELD_ID_RE = /^[a-z][a-z0-9_]{0,49}$/;

async function requireAttachmentAccess(
  req: Request,
  applicationId: string
): Promise<void> {
  if (req.headers.get('x-session-token')) {
    await loadOwnedApplication(applicationId, req);
    return;
  }

  await requireStaffRole(
    req,
    STAFF_PERMISSIONS.reviewCitizenApplications,
    'Chỉ cán bộ xét duyệt hồ sơ mới được xem tệp đính kèm.'
  );
  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      status: { in: ['SUBMITTED', 'APPROVED', 'RETURNED'] },
    },
    select: { id: true },
  });
  if (!application) {
    throw new AppError(404, 'ATTACHMENT_NOT_FOUND', 'Không tìm thấy tệp đính kèm.');
  }
}

export const GET = handleRoute(async (
  req: Request,
  { params }: { params: Promise<{ id: string; fieldId: string }> }
) => {
  enforceRateLimit('application-attachment-read', req, { limit: 60, windowMs: 60_000 });
  const { id, fieldId } = await params;
  if (!FIELD_ID_RE.test(fieldId)) {
    throw new AppError(404, 'ATTACHMENT_NOT_FOUND', 'Không tìm thấy tệp đính kèm.');
  }

  await requireAttachmentAccess(req, id);

  const attachment = await prisma.applicationAttachment.findUnique({
    where: { applicationId_fieldId: { applicationId: id, fieldId } },
  });
  if (!attachment) {
    throw new AppError(
      404,
      'ATTACHMENT_NOT_FOUND',
      'Tệp này chưa được tải lên hệ thống. Vui lòng chọn và tải lại tệp.'
    );
  }

  const url = new URL(req.url);
  const disposition = url.searchParams.get('download') === '1' ? 'attachment' : 'inline';
  const responseBytes = Uint8Array.from(attachment.content);
  return new Response(responseBytes.buffer, {
    status: 200,
    headers: {
      'Content-Type': attachment.mimeType,
      'Content-Length': String(attachment.byteSize),
      'Content-Disposition': attachmentContentDisposition(attachment.fileName, disposition),
      'Cache-Control': 'private, no-store, max-age=0',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    },
  });
});

export const POST = handleRoute(async (
  req: Request,
  { params }: { params: Promise<{ id: string; fieldId: string }> }
) => {
  enforceRateLimit('application-attachment-upload', req, { limit: 20, windowMs: 10 * 60_000 });
  const { id, fieldId } = await params;
  if (!FIELD_ID_RE.test(fieldId)) {
    throw new AppError(400, 'INVALID_ATTACHMENT_FIELD', 'Trường tệp đính kèm không hợp lệ.');
  }

  const declaredLength = Number(req.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_ATTACHMENT_REQUEST_BYTES) {
    throw new AppError(413, 'ATTACHMENT_TOO_LARGE', 'Tệp đính kèm không được vượt quá 10 MB.');
  }

  const { application, pinned } = await loadOwnedApplication(id, req);
  if (!(EDITABLE_STATUSES as readonly string[]).includes(application.status)) {
    throw new AppError(409, 'APPLICATION_NOT_EDITABLE', 'Hồ sơ đã nộp nên không thể thay đổi tệp đính kèm.');
  }
  const field = pinned.fields.find((item) => item.id === fieldId);
  if (!field || field.type !== 'file') {
    throw new AppError(400, 'INVALID_ATTACHMENT_FIELD', 'Trường tệp đính kèm không hợp lệ.');
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new AppError(400, 'INVALID_ATTACHMENT', 'Không đọc được tệp đính kèm.');
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    throw new AppError(400, 'INVALID_ATTACHMENT', 'Vui lòng chọn một tệp để tải lên.');
  }
  if (file.size < 1 || file.size > MAX_ATTACHMENT_BYTES) {
    throw new AppError(413, 'ATTACHMENT_TOO_LARGE', 'Tệp đính kèm phải có dung lượng từ 1 byte đến 10 MB.');
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detectedMime = detectSafeAttachmentMime(bytes);
  if (!detectedMime) {
    throw new AppError(
      415,
      'ATTACHMENT_TYPE_NOT_ALLOWED',
      'Chỉ chấp nhận tệp PDF hoặc ảnh JPG, PNG, WebP.'
    );
  }

  const fileName = sanitizeAttachmentFileName(file.name);
  await prisma.applicationAttachment.upsert({
    where: { applicationId_fieldId: { applicationId: id, fieldId } },
    update: {
      fileName,
      mimeType: detectedMime,
      byteSize: bytes.byteLength,
      content: Buffer.from(bytes),
    },
    create: {
      applicationId: id,
      fieldId,
      fileName,
      mimeType: detectedMime,
      byteSize: bytes.byteLength,
      content: Buffer.from(bytes),
    },
  });

  return jsonOk({
    fieldId,
    fileName,
    mimeType: detectedMime,
    byteSize: bytes.byteLength,
  }, { status: 201 });
});

export const DELETE = handleRoute(async (
  req: Request,
  { params }: { params: Promise<{ id: string; fieldId: string }> }
) => {
  enforceRateLimit('application-attachment-delete', req, { limit: 20, windowMs: 10 * 60_000 });
  const { id, fieldId } = await params;
  if (!FIELD_ID_RE.test(fieldId)) {
    throw new AppError(400, 'INVALID_ATTACHMENT_FIELD', 'Trường tệp đính kèm không hợp lệ.');
  }
  const { application } = await loadOwnedApplication(id, req);
  if (!(EDITABLE_STATUSES as readonly string[]).includes(application.status)) {
    throw new AppError(409, 'APPLICATION_NOT_EDITABLE', 'Hồ sơ đã nộp nên không thể thay đổi tệp đính kèm.');
  }
  await prisma.applicationAttachment.deleteMany({
    where: { applicationId: id, fieldId },
  });
  return jsonOk({ removed: true, fieldId });
});
