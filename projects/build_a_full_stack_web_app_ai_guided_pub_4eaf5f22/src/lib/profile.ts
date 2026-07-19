import { AppError } from './errors';

export type ProfileUpdate = {
  displayName: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: Date | null;
  address: string | null;
  citizenId: string | null;
  gender: string | null;
  placeOfBirth: string | null;
  idIssuedAt: Date | null;
  idExpiresAt: Date | null;
};

function nullableString(
  body: Record<string, unknown>,
  key: string,
  maxLength: number
): string | null {
  const value = body[key];
  if (typeof value !== 'string') {
    throw new AppError(400, 'INVALID_INPUT', 'Trường dữ liệu không hợp lệ.', { field: key });
  }
  const normalized = value.trim();
  if (normalized.length > maxLength) {
    throw new AppError(400, 'VALUE_TOO_LONG', 'Giá trị quá dài.', { field: key });
  }
  return normalized || null;
}

function parseDate(
  body: Record<string, unknown>,
  key: 'dateOfBirth' | 'idIssuedAt' | 'idExpiresAt'
): Date | null {
  const text = nullableString(body, key, 10);
  if (!text) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new AppError(400, 'INVALID_INPUT', 'Ngày tháng không hợp lệ.', { field: key });
  }
  const date = new Date(`${text}T00:00:00.000Z`);
  const earliest = new Date('1900-01-01T00:00:00.000Z');
  // So sánh theo ngày ở múi giờ Việt Nam (UTC+7): buổi tối giờ VN, "hôm nay"
  // theo lịch VN đã vượt trước ngày UTC — thẻ cấp trong ngày không được bị chặn.
  const todayVietnam = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== text ||
    date < earliest ||
    ((key === 'dateOfBirth' || key === 'idIssuedAt') && text > todayVietnam)
  ) {
    throw new AppError(400, 'INVALID_INPUT', 'Ngày tháng không hợp lệ.', { field: key });
  }
  return date;
}

export function parseProfileUpdate(body: Record<string, unknown>): ProfileUpdate {
  const displayName = nullableString(body, 'displayName', 120);
  if (!displayName || displayName.length < 2) {
    throw new AppError(400, 'INVALID_INPUT', 'Họ và tên cần có ít nhất 2 ký tự.', {
      field: 'displayName',
    });
  }

  const email = nullableString(body, 'email', 254)?.toLowerCase() ?? null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new AppError(400, 'INVALID_INPUT', 'Địa chỉ email không hợp lệ.', {
      field: 'email',
    });
  }

  const phone = nullableString(body, 'phone', 20)?.replace(/[\s().-]/g, '') ?? null;
  if (phone && !/^(?:\+84|0)[0-9]{9,10}$/.test(phone)) {
    throw new AppError(400, 'INVALID_INPUT', 'Số điện thoại không hợp lệ.', {
      field: 'phone',
    });
  }

  const citizenId = nullableString(body, 'citizenId', 12);
  if (citizenId && !/^[0-9]{12}$/.test(citizenId)) {
    throw new AppError(400, 'INVALID_INPUT', 'Số định danh cá nhân phải gồm 12 chữ số.', {
      field: 'citizenId',
    });
  }

  const gender = nullableString(body, 'gender', 20);
  if (gender && !['Nam', 'Nữ', 'Khác'].includes(gender)) {
    throw new AppError(400, 'INVALID_INPUT', 'Giới tính không hợp lệ.', { field: 'gender' });
  }

  return {
    displayName,
    email,
    phone,
    dateOfBirth: parseDate(body, 'dateOfBirth'),
    address: nullableString(body, 'address', 300),
    citizenId,
    gender,
    placeOfBirth: nullableString(body, 'placeOfBirth', 300),
    idIssuedAt: parseDate(body, 'idIssuedAt'),
    idExpiresAt: parseDate(body, 'idExpiresAt'),
  };
}
