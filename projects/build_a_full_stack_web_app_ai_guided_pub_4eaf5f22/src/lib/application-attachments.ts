export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const MAX_ATTACHMENT_REQUEST_BYTES = MAX_ATTACHMENT_BYTES + 256 * 1024;

export const ATTACHMENT_ACCEPT =
  'application/pdf,image/jpeg,image/png,image/webp';

const SAFE_MIME_TYPES = new Set([
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
]);

export function sanitizeAttachmentFileName(value: string): string {
  const base = value
    .normalize('NFC')
    .split(/[\\/]/)
    .pop()
    ?.replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  const safe = base && base.length > 0 ? base : 'tep-dinh-kem';
  return safe.slice(0, 180);
}

export function detectSafeAttachmentMime(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 5 &&
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  ) {
    return 'application/pdf';
  }
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
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
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return null;
}

export function isSafeAttachmentMime(value: string): boolean {
  return SAFE_MIME_TYPES.has(value);
}

export function attachmentContentDisposition(
  fileName: string,
  mode: 'inline' | 'attachment'
): string {
  const safeAscii = sanitizeAttachmentFileName(fileName)
    .replace(/[^\x20-\x7e]/g, '_')
    .replace(/["\\]/g, '_');
  const encoded = encodeURIComponent(sanitizeAttachmentFileName(fileName));
  return `${mode}; filename="${safeAscii}"; filename*=UTF-8''${encoded}`;
}
