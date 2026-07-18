import { prisma } from '@/lib/db';
import { AppError, handleRoute, jsonOk } from '@/lib/errors';
import {
  decryptIdentityImage,
  encryptIdentityImage,
} from '@/lib/identity-document-crypto';
import { requireAuthUser } from '@/lib/login-auth';
import { enforceRateLimit } from '@/lib/rate-limit';

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_IMAGE_BYTES * 2 + 1024 * 1024;
const RETENTION_DAYS = 30;

type ValidImage = {
  bytes: Buffer;
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp';
};

function sniffImage(bytes: Buffer): ValidImage['mimeType'] | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString('ascii') === 'RIFF' &&
    bytes.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

async function validateImage(value: FormDataEntryValue | null, side: string): Promise<ValidImage> {
  if (!(value instanceof File)) {
    throw new AppError(400, 'INVALID_INPUT', `Vui lòng cung cấp ảnh ${side} căn cước.`);
  }
  if (value.size <= 0 || value.size > MAX_IMAGE_BYTES) {
    throw new AppError(
      400,
      'INVALID_FILE_SIZE',
      `Ảnh ${side} phải có dung lượng không quá 4 MB.`
    );
  }
  const bytes = Buffer.from(await value.arrayBuffer());
  const mimeType = sniffImage(bytes);
  if (!mimeType) {
    throw new AppError(
      400,
      'INVALID_FILE_TYPE',
      `Ảnh ${side} phải có định dạng JPEG, PNG hoặc WebP.`
    );
  }
  return { bytes, mimeType };
}

async function removeExpiredDocuments(): Promise<void> {
  await prisma.identityDocument.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}

export const GET = handleRoute(async (req: Request) => {
  const user = await requireAuthUser(req, ['user']);
  await removeExpiredDocuments();
  const document = await prisma.identityDocument.findUnique({ where: { userId: user.id } });

  const side = new URL(req.url).searchParams.get('side');
  if (!side) {
    return jsonOk({
      document: document
        ? {
            status: document.status,
            frontByteSize: document.frontByteSize,
            backByteSize: document.backByteSize,
            createdAt: document.createdAt.toISOString(),
            expiresAt: document.expiresAt.toISOString(),
          }
        : null,
    });
  }

  if (!document) {
    throw new AppError(404, 'NOT_FOUND', 'Chưa có ảnh căn cước được lưu.');
  }
  if (side !== 'front' && side !== 'back') {
    throw new AppError(400, 'INVALID_INPUT', 'Mặt căn cước không hợp lệ.');
  }

  const bytes =
    side === 'front'
      ? decryptIdentityImage({
          ciphertext: Buffer.from(document.frontCiphertext),
          iv: Buffer.from(document.frontIv),
          authTag: Buffer.from(document.frontAuthTag),
        })
      : decryptIdentityImage({
          ciphertext: Buffer.from(document.backCiphertext),
          iv: Buffer.from(document.backIv),
          authTag: Buffer.from(document.backAuthTag),
        });
  const mimeType = side === 'front' ? document.frontMimeType : document.backMimeType;

  return new Response(new Uint8Array(bytes), {
    headers: {
      'Content-Type': mimeType,
      'Content-Disposition': `attachment; filename="can-cuoc-${side}.jpg"`,
      'Cache-Control': 'no-store, private',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
    },
  });
});

export const POST = handleRoute(async (req: Request) => {
  const user = await requireAuthUser(req, ['user']);
  enforceRateLimit('identity-document-upload', req, { limit: 5, windowMs: 10 * 60 * 1000 });

  const contentLength = Number(req.headers.get('content-length') || '0');
  if (Number.isFinite(contentLength) && contentLength > MAX_REQUEST_BYTES) {
    throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Hai ảnh căn cước vượt quá dung lượng cho phép.');
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    throw new AppError(400, 'INVALID_FORM_DATA', 'Không thể đọc ảnh căn cước.');
  }
  if (form.get('consent') !== 'true') {
    throw new AppError(
      400,
      'CONSENT_REQUIRED',
      'Bạn cần đồng ý việc xử lý ảnh để tiếp tục.'
    );
  }

  const [front, back] = await Promise.all([
    validateImage(form.get('front'), 'mặt trước'),
    validateImage(form.get('back'), 'mặt sau'),
  ]);
  const encryptedFront = encryptIdentityImage(front.bytes);
  const encryptedBack = encryptIdentityImage(back.bytes);
  const consentAt = new Date();
  const expiresAt = new Date(consentAt.getTime() + RETENTION_DAYS * 24 * 60 * 60 * 1000);

  await removeExpiredDocuments();
  const document = await prisma.identityDocument.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      status: 'CAPTURED_NOT_VERIFIED',
      frontCiphertext: encryptedFront.ciphertext,
      frontIv: encryptedFront.iv,
      frontAuthTag: encryptedFront.authTag,
      frontMimeType: front.mimeType,
      frontByteSize: front.bytes.length,
      backCiphertext: encryptedBack.ciphertext,
      backIv: encryptedBack.iv,
      backAuthTag: encryptedBack.authTag,
      backMimeType: back.mimeType,
      backByteSize: back.bytes.length,
      consentAt,
      expiresAt,
    },
    update: {
      status: 'CAPTURED_NOT_VERIFIED',
      frontCiphertext: encryptedFront.ciphertext,
      frontIv: encryptedFront.iv,
      frontAuthTag: encryptedFront.authTag,
      frontMimeType: front.mimeType,
      frontByteSize: front.bytes.length,
      backCiphertext: encryptedBack.ciphertext,
      backIv: encryptedBack.iv,
      backAuthTag: encryptedBack.authTag,
      backMimeType: back.mimeType,
      backByteSize: back.bytes.length,
      consentAt,
      expiresAt,
    },
  });

  return jsonOk({
    document: {
      status: document.status,
      expiresAt: document.expiresAt.toISOString(),
    },
    message: 'Đã lưu an toàn hai mặt căn cước. Danh tính chưa được xác thực.',
  });
});

export const DELETE = handleRoute(async (req: Request) => {
  const user = await requireAuthUser(req, ['user']);
  enforceRateLimit('identity-document-delete', req, { limit: 10, windowMs: 60 * 1000 });
  await prisma.identityDocument.deleteMany({ where: { userId: user.id } });
  return jsonOk({ deleted: true, message: 'Đã xóa ảnh căn cước.' });
});
