import { LIMITS } from '@/lib/constants';
import { getTrustProxy } from '@/lib/config';
import { AppError } from '@/lib/errors';

/**
 * Reads and parses a JSON request body with strict size checks.
 */
export async function readJsonBody(
  req: Request,
  maxBytes = LIMITS.JSON_BODY_MAX_BYTES
): Promise<Record<string, unknown>> {
  const contentLengthStr = req.headers.get('content-length');
  if (contentLengthStr) {
    const contentLength = Number(contentLengthStr);
    if (Number.isFinite(contentLength) && contentLength >= 0 && contentLength > maxBytes) {
      throw new AppError(400, 'BODY_TOO_LARGE', 'Kích thước yêu cầu vượt quá giới hạn.');
    }
  }

  if (!req.body) {
    throw new AppError(400, 'INVALID_JSON', 'Nội dung yêu cầu trống.');
  }

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      let done = false;
      let value: Uint8Array | undefined;
      try {
        const result = await reader.read();
        done = result.done;
        value = result.value;
      } catch (readErr) {
        throw new AppError(400, 'INVALID_JSON', 'Lỗi đọc luồng dữ liệu.');
      }

      if (done) {
        break;
      }

      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          try {
            await reader.cancel();
          } catch (_) {}
          throw new AppError(400, 'BODY_TOO_LARGE', 'Kích thước yêu cầu vượt quá giới hạn.');
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  if (totalBytes === 0) {
    throw new AppError(400, 'INVALID_JSON', 'Nội dung yêu cầu trống.');
  }

  if (totalBytes > maxBytes) {
    throw new AppError(400, 'BODY_TOO_LARGE', 'Kích thước yêu cầu vượt quá giới hạn.');
  }

  const concatenated = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    concatenated.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let decodedText: string;
  try {
    const decoder = new TextDecoder('utf-8', { fatal: true });
    decodedText = decoder.decode(concatenated);
  } catch (decodeErr) {
    throw new AppError(400, 'INVALID_JSON', 'Giải mã UTF-8 không hợp lệ.');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(decodedText);
  } catch (parseErr) {
    throw new AppError(400, 'INVALID_JSON', 'Cấu trúc JSON không hợp lệ.');
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new AppError(400, 'INVALID_JSON', 'Dữ liệu không phải là một đối tượng JSON.');
  }

  return parsed as Record<string, unknown>;
}

export function requireString(body: Record<string, unknown>, key: string, maxLen = 1000): string {
  const val = body[key];
  if (typeof val !== 'string') {
    throw new AppError(400, 'INVALID_INPUT', 'Trường dữ liệu không hợp lệ.', { field: key });
  }
  const trimmed = val.trim();
  if (trimmed === '') {
    throw new AppError(400, 'INVALID_INPUT', 'Trường dữ liệu không hợp lệ.', { field: key });
  }
  if (trimmed.length > maxLen) {
    throw new AppError(400, 'VALUE_TOO_LONG', 'Giá trị quá dài.', { field: key });
  }
  return trimmed;
}

export function optionalString(body: Record<string, unknown>, key: string, maxLen = 1000): string | undefined {
  const val = body[key];
  if (val === undefined) {
    return undefined;
  }
  if (typeof val !== 'string') {
    throw new AppError(400, 'INVALID_INPUT', 'Trường dữ liệu không hợp lệ.', { field: key });
  }
  const trimmed = val.trim();
  if (trimmed === '') {
    // An optional field sent as an empty string means "not provided".
    return undefined;
  }
  if (trimmed.length > maxLen) {
    throw new AppError(400, 'VALUE_TOO_LONG', 'Giá trị quá dài.', { field: key });
  }
  return trimmed;
}

export function optionalObject(body: Record<string, unknown>, key: string): Record<string, unknown> | undefined {
  const val = body[key];
  if (val === undefined) {
    return undefined;
  }
  if (typeof val !== 'object' || val === null || Array.isArray(val)) {
    throw new AppError(400, 'INVALID_INPUT', 'Trường dữ liệu không hợp lệ.', { field: key });
  }
  return val as Record<string, unknown>;
}

/**
 * Enable trust ONLY when the service is not directly reachable and every request traverses
 * exactly one trusted edge that appends the real client IP as the final x-forwarded-for entry;
 * behind a chain of trusted proxies the last entry may be an inner proxy, which collapses
 * those clients into one shared bucket (over-restrictive, never a bypass); in any other
 * topology leave trust off so all clients share the fail-closed 'global' bucket. The web
 * Request API exposes no peer socket address, so the flag is the operator's topology assertion.
 */
export function getClientIp(req: Request): string {
  if (!getTrustProxy()) {
    return 'global';
  }

  const xForwardedFor = req.headers.get('x-forwarded-for');
  if (!xForwardedFor) {
    return 'global';
  }

  const trimmedHeader = xForwardedFor.trim();
  if (trimmedHeader === '') {
    return 'global';
  }

  const lastCommaIndex = trimmedHeader.lastIndexOf(',');
  let candidate = lastCommaIndex === -1
    ? trimmedHeader
    : trimmedHeader.substring(lastCommaIndex + 1);

  candidate = candidate.trim();

  if (!isValidIp(candidate)) {
    return 'global';
  }

  return candidate.toLowerCase();
}

export function aiMeta(provider: string, degraded: boolean): { aiMode: string; degraded: boolean } {
  return {
    aiMode: provider,
    degraded,
  };
}

function isValidIp(value: string): boolean {
  return isValidIpv4(value) || isValidIpv6(value);
}

function isValidIpv4(value: string): boolean {
  const parts = value.split('.');
  if (parts.length !== 4) {
    return false;
  }
  for (const part of parts) {
    if (part.length === 0 || part.length > 3) {
      return false;
    }
    for (let i = 0; i < part.length; i++) {
      const charCode = part.charCodeAt(i);
      if (charCode < 48 || charCode > 57) {
        return false;
      }
    }
    const num = parseInt(part, 10);
    if (num > 255) {
      return false;
    }
  }
  return true;
}

function isValidIpv6(value: string): boolean {
  if (value.length > 45) {
    return false;
  }
  if (!/^[0-9a-fA-F:.]+$/.test(value)) {
    return false;
  }
  if (!value.includes(':')) {
    return false;
  }
  const doubleColonIndex = value.indexOf('::');
  if (doubleColonIndex !== -1) {
    if (value.indexOf('::', doubleColonIndex + 2) !== -1) {
      return false;
    }
  }

  let leftGroups: string[] = [];
  let rightGroups: string[] = [];

  if (doubleColonIndex !== -1) {
    const leftSide = value.substring(0, doubleColonIndex);
    const rightSide = value.substring(doubleColonIndex + 2);

    if (leftSide !== '') {
      leftGroups = leftSide.split(':');
    }
    if (rightSide !== '') {
      rightGroups = rightSide.split(':');
    }
  } else {
    leftGroups = value.split(':');
  }

  if (leftGroups.some(g => g === '')) {
    return false;
  }
  if (rightGroups.some(g => g === '')) {
    return false;
  }

  const allGroups = doubleColonIndex !== -1 ? [...leftGroups, ...rightGroups] : leftGroups;

  if (allGroups.length === 0) {
    return true;
  }

  const finalGroup = allGroups[allGroups.length - 1];
  const finalIsIpv4 = isValidIpv4(finalGroup);

  if (doubleColonIndex !== -1) {
    const totalCount = finalIsIpv4 ? allGroups.length + 1 : allGroups.length;
    if (totalCount > 7) {
      return false;
    }
  } else {
    const totalCount = finalIsIpv4 ? allGroups.length + 1 : allGroups.length;
    if (totalCount !== 8) {
      return false;
    }
  }

  for (let i = 0; i < allGroups.length; i++) {
    const group = allGroups[i];
    if (i === allGroups.length - 1 && finalIsIpv4) {
      continue;
    }
    if (group.length === 0 || group.length > 4) {
      return false;
    }
    for (let j = 0; j < group.length; j++) {
      const charCode = group.charCodeAt(j);
      const isHex = (charCode >= 48 && charCode <= 57) ||
                    (charCode >= 65 && charCode <= 70) ||
                    (charCode >= 97 && charCode <= 102);
      if (!isHex) {
        return false;
      }
    }
  }

  return true;
}