export type CitizenIdScanData = {
  citizenId?: string;
  displayName?: string;
  dateOfBirth?: string;
  gender?: 'Nam' | 'Nữ' | 'Khác';
  address?: string;
  placeOfBirth?: string;
  idIssuedAt?: string;
  idExpiresAt?: string;
};

function toIsoDate(value: string | undefined): string | undefined {
  if (!value) return undefined;
  const normalized = value.trim();
  let year: string;
  let month: string;
  let day: string;

  if (/^\d{8}$/.test(normalized)) {
    day = normalized.slice(0, 2);
    month = normalized.slice(2, 4);
    year = normalized.slice(4);
  } else {
    const match = normalized.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
    if (!match) {
      return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : undefined;
    }
    [, day, month, year] = match;
  }

  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const parsed = new Date(`${iso}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === iso
    ? iso
    : undefined;
}

function normalizeGender(value: string | undefined): CitizenIdScanData['gender'] {
  if (!value) return undefined;
  const lower = value.trim().toLocaleLowerCase('vi');
  if (lower === 'nam' || lower === 'male' || lower === 'm') return 'Nam';
  if (lower === 'nữ' || lower === 'nu' || lower === 'female' || lower === 'f') return 'Nữ';
  return undefined;
}

function clean(value: string | undefined): string | undefined {
  const normalized = value?.replace(/\s+/g, ' ').trim();
  return normalized || undefined;
}

/**
 * Vietnamese chip cards commonly encode pipe-separated values in their QR:
 * personal id | old id | full name | birth date | gender | address | issue date.
 * Labeled key/value payloads are also accepted for newer readers.
 */
export function parseCitizenIdQr(raw: string): CitizenIdScanData | null {
  const text = raw.replace(/\u0000/g, '').trim();
  if (!text) return null;

  const parts = text
    .split(/[|\u001d]/)
    .map((part) => part.trim())
    .filter(Boolean);

  const citizenIdIndex = parts.findIndex((part) => /^[0-9]{12}$/.test(part));
  if (citizenIdIndex >= 0 && parts.length >= citizenIdIndex + 5) {
    const base = citizenIdIndex;
    const hasOldId = /^[0-9]{9,12}$/.test(parts[base + 1] ?? '');
    const offset = hasOldId ? 2 : 1;
    const displayName = clean(parts[base + offset]);
    const dateOfBirth = toIsoDate(parts[base + offset + 1]);
    const gender = normalizeGender(parts[base + offset + 2]);
    const address = clean(parts[base + offset + 3]);
    const idIssuedAt = toIsoDate(parts[base + offset + 4]);

    if (displayName || dateOfBirth || address) {
      return {
        citizenId: parts[base],
        displayName,
        dateOfBirth,
        gender,
        address,
        idIssuedAt,
      };
    }
  }

  const labeled: CitizenIdScanData = {};
  const labels: Array<[keyof CitizenIdScanData, RegExp]> = [
    [
      'citizenId',
      /(?:số định danh(?: cá nhân)?|personal identification number|id no\.?)\s*[:\-]\s*([0-9]{12})/i,
    ],
    ['displayName', /(?:họ (?:và )?tên|full name)\s*[:\-]\s*([^\n|]+)/i],
    ['dateOfBirth', /(?:ngày sinh|date of birth)\s*[:\-]\s*([0-9/-]+)/i],
    ['gender', /(?:giới tính|sex)\s*[:\-]\s*([^\n|]+)/i],
    ['address', /(?:nơi cư trú|place of residence)\s*[:\-]\s*([^\n|]+)/i],
    ['placeOfBirth', /(?:nơi đăng ký khai sinh|place of birth)\s*[:\-]\s*([^\n|]+)/i],
    ['idIssuedAt', /(?:ngày cấp|date of issue)\s*[:\-]\s*([0-9/-]+)/i],
    ['idExpiresAt', /(?:ngày hết hạn|date of expiry)\s*[:\-]\s*([0-9/-]+)/i],
  ];

  for (const [key, pattern] of labels) {
    const value = text.match(pattern)?.[1];
    if (!value) continue;
    if (key === 'dateOfBirth' || key === 'idIssuedAt' || key === 'idExpiresAt') {
      const parsed = toIsoDate(value);
      if (parsed) labeled[key] = parsed;
    } else if (key === 'gender') {
      const parsed = normalizeGender(value);
      if (parsed) labeled.gender = parsed;
    } else {
      (labeled as Record<string, string>)[key] = clean(value) ?? '';
    }
  }

  return labeled.citizenId || labeled.displayName ? labeled : null;
}
