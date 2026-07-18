import { AppError } from './errors';

export type ProfileUpdate = {
  displayName: string;
  email: string | null;
  phone: string | null;
  dateOfBirth: Date | null;
  address: string | null;
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

  const dateText = nullableString(body, 'dateOfBirth', 10);
  let dateOfBirth: Date | null = null;
  if (dateText) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) {
      throw new AppError(400, 'INVALID_INPUT', 'Ngày sinh không hợp lệ.', {
        field: 'dateOfBirth',
      });
    }
    dateOfBirth = new Date(`${dateText}T00:00:00.000Z`);
    const today = new Date();
    const earliest = new Date('1900-01-01T00:00:00.000Z');
    if (
      Number.isNaN(dateOfBirth.getTime()) ||
      dateOfBirth.toISOString().slice(0, 10) !== dateText ||
      dateOfBirth > today ||
      dateOfBirth < earliest
    ) {
      throw new AppError(400, 'INVALID_INPUT', 'Ngày sinh không hợp lệ.', {
        field: 'dateOfBirth',
      });
    }
  }

  return {
    displayName,
    email,
    phone,
    dateOfBirth,
    address: nullableString(body, 'address', 300),
  };
}
