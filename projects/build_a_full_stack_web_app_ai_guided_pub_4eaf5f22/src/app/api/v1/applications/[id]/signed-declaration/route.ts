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
  SIGNED_DECLARATION_FIELD_ID,
} from '@/lib/application-attachments';
import { verifySignedDeclaration } from '@/lib/ai/document-check';
import type { Prisma } from '@prisma/client';

/**
 * The signed declaration (tờ khai đã ký) a citizen must upload before an
 * application can be handed over for review: they download the generated PDF,
 * sign it (by hand + scan/photo, or a digital signature), and upload the signed
 * copy here. It is stored in the same encrypted ApplicationAttachment table
 * under a reserved key, and the submit route refuses to queue an application
 * that has no signed copy.
 */

const FIELD = SIGNED_DECLARATION_FIELD_ID;

/** Owner (X-Session-Token) or a reviewing officer may read the signed copy. */
async function requireSignedDeclarationAccess(req: Request, applicationId: string): Promise<void> {
  if (req.headers.get('x-session-token')) {
    await loadOwnedApplication(applicationId, req);
    return;
  }

  await requireStaffRole(
    req,
    STAFF_PERMISSIONS.reviewCitizenApplications,
    'Chỉ cán bộ xét duyệt hồ sơ mới được xem tờ khai đã ký.'
  );
  const application = await prisma.application.findFirst({
    where: {
      id: applicationId,
      status: { in: ['SUBMITTED', 'APPROVED', 'RETURNED'] },
    },
    select: { id: true },
  });
  if (!application) {
    throw new AppError(404, 'ATTACHMENT_NOT_FOUND', 'Không tìm thấy tờ khai đã ký.');
  }
}

export const GET = handleRoute(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  enforceRateLimit('application-attachment-read', req, { limit: 60, windowMs: 60_000 });
  const { id } = await params;

  await requireSignedDeclarationAccess(req, id);

  const attachment = await prisma.applicationAttachment.findUnique({
    where: { applicationId_fieldId: { applicationId: id, fieldId: FIELD } },
  });
  if (!attachment) {
    throw new AppError(404, 'ATTACHMENT_NOT_FOUND', 'Hồ sơ chưa có tờ khai đã ký.');
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
  { params }: { params: Promise<{ id: string }> }
) => {
  enforceRateLimit('application-attachment-upload', req, { limit: 20, windowMs: 10 * 60_000 });
  const { id } = await params;

  const declaredLength = Number(req.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_ATTACHMENT_REQUEST_BYTES) {
    throw new AppError(413, 'ATTACHMENT_TOO_LARGE', 'Tệp tờ khai không được vượt quá 10 MB.');
  }

  const { application } = await loadOwnedApplication(id, req);
  if (!(EDITABLE_STATUSES as readonly string[]).includes(application.status)) {
    throw new AppError(409, 'APPLICATION_NOT_EDITABLE', 'Hồ sơ đã nộp nên không thể thay đổi tờ khai đã ký.');
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new AppError(400, 'INVALID_ATTACHMENT', 'Không đọc được tệp tờ khai.');
  }
  const file = form.get('file');
  if (!(file instanceof File)) {
    throw new AppError(400, 'INVALID_ATTACHMENT', 'Vui lòng chọn tệp tờ khai đã ký để tải lên.');
  }
  if (file.size < 1 || file.size > MAX_ATTACHMENT_BYTES) {
    throw new AppError(413, 'ATTACHMENT_TOO_LARGE', 'Tệp tờ khai phải có dung lượng từ 1 byte đến 10 MB.');
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const detectedMime = detectSafeAttachmentMime(bytes);
  if (!detectedMime) {
    throw new AppError(
      415,
      'ATTACHMENT_TYPE_NOT_ALLOWED',
      'Chỉ chấp nhận tờ khai dạng PDF hoặc ảnh JPG, PNG, WebP.'
    );
  }

  // Let an AI vision model look at the signed copy before it can reach the
  // officer. A confident "this is not a signed declaration" blocks the upload;
  // anything else is stored with the verdict for the officer to weigh.
  const check = await verifySignedDeclaration({ bytes, mimeType: detectedMime });
  if (check.status === 'REJECTED') {
    throw new AppError(422, 'SIGNED_DECLARATION_INVALID', check.reason, {
      check,
    });
  }

  const fileName = sanitizeAttachmentFileName(file.name);
  const checkJson = check as unknown as Prisma.InputJsonValue;
  await prisma.applicationAttachment.upsert({
    where: { applicationId_fieldId: { applicationId: id, fieldId: FIELD } },
    update: {
      fileName,
      mimeType: detectedMime,
      byteSize: bytes.byteLength,
      content: Buffer.from(bytes),
      checkJson,
    },
    create: {
      applicationId: id,
      fieldId: FIELD,
      fileName,
      mimeType: detectedMime,
      byteSize: bytes.byteLength,
      content: Buffer.from(bytes),
      checkJson,
    },
  });

  return jsonOk({
    fileName,
    mimeType: detectedMime,
    byteSize: bytes.byteLength,
    check,
  }, { status: 201 });
});

export const DELETE = handleRoute(async (
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) => {
  enforceRateLimit('application-attachment-delete', req, { limit: 20, windowMs: 10 * 60_000 });
  const { id } = await params;
  const { application } = await loadOwnedApplication(id, req);
  if (!(EDITABLE_STATUSES as readonly string[]).includes(application.status)) {
    throw new AppError(409, 'APPLICATION_NOT_EDITABLE', 'Hồ sơ đã nộp nên không thể thay đổi tờ khai đã ký.');
  }
  await prisma.applicationAttachment.deleteMany({
    where: { applicationId: id, fieldId: FIELD },
  });
  return jsonOk({ removed: true });
});
