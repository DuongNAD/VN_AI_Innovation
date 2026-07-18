/**
 * Danh mục phân loại đơn / hồ sơ hành chính công.
 * Dùng cho dropdown người dân, filter manager, badge màu, và thống kê dashboard.
 */

export const DOCUMENT_TYPE_CODES = [
  'MARRIAGE_REGISTRATION',
  'DIVORCE_APPLICATION',
  'BIRTH_CERTIFICATE',
  'DEATH_CERTIFICATE',
  'TEMPORARY_RESIDENCE',
  'MARITAL_STATUS_CONFIRMATION',
  'DOCUMENT_AUTHENTICATION',
  'OTHER',
] as const;

export type DocumentTypeCode = (typeof DOCUMENT_TYPE_CODES)[number];

export type DocumentTypeMeta = {
  code: DocumentTypeCode;
  /** Nhãn tiếng Việt ngắn gọn. */
  label: string;
  /** Mô tả một dòng cho dropdown / tooltip. */
  description: string;
  /** Emoji / ký hiệu hiển thị cạnh badge. */
  icon: string;
  /** Tailwind classes for pill badge. */
  badgeClass: string;
  /** Tailwind classes for stat card accent. */
  accentClass: string;
};

export const DOCUMENT_TYPES: readonly DocumentTypeMeta[] = [
  {
    code: 'MARRIAGE_REGISTRATION',
    label: 'Đơn đăng ký kết hôn',
    description: 'Đăng ký kết hôn tại UBND cấp xã / huyện',
    icon: '💍',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200',
    accentClass: 'border-rose-200 bg-rose-50 text-rose-900',
  },
  {
    code: 'DIVORCE_APPLICATION',
    label: 'Đơn ly hôn',
    description: 'Thuận tình hoặc đơn phương ly hôn',
    icon: '📑',
    badgeClass: 'bg-orange-100 text-orange-900 border-orange-200',
    accentClass: 'border-orange-200 bg-orange-50 text-orange-950',
  },
  {
    code: 'BIRTH_CERTIFICATE',
    label: 'Đơn khai sinh',
    description: 'Đăng ký khai sinh cho trẻ em',
    icon: '👶',
    badgeClass: 'bg-sky-100 text-sky-900 border-sky-200',
    accentClass: 'border-sky-200 bg-sky-50 text-sky-950',
  },
  {
    code: 'DEATH_CERTIFICATE',
    label: 'Đơn khai tử',
    description: 'Đăng ký khai tử',
    icon: '🕯️',
    badgeClass: 'bg-slate-200 text-slate-800 border-slate-300',
    accentClass: 'border-slate-300 bg-slate-100 text-slate-900',
  },
  {
    code: 'TEMPORARY_RESIDENCE',
    label: 'Tạm trú / tạm vắng',
    description: 'Đăng ký tạm trú hoặc tạm vắng',
    icon: '🏠',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    accentClass: 'border-emerald-200 bg-emerald-50 text-emerald-950',
  },
  {
    code: 'MARITAL_STATUS_CONFIRMATION',
    label: 'Xác nhận tình trạng hôn nhân',
    description: 'Giấy xác nhận tình trạng hôn nhân',
    icon: '📄',
    badgeClass: 'bg-violet-100 text-violet-900 border-violet-200',
    accentClass: 'border-violet-200 bg-violet-50 text-violet-950',
  },
  {
    code: 'DOCUMENT_AUTHENTICATION',
    label: 'Chứng thực giấy tờ',
    description: 'Chứng thực bản sao / chữ ký / hợp đồng',
    icon: '✍️',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-200',
    accentClass: 'border-amber-200 bg-amber-50 text-amber-950',
  },
  {
    code: 'OTHER',
    label: 'Loại đơn khác',
    description: 'Thủ tục khác ngoài các nhóm trên',
    icon: '📋',
    badgeClass: 'bg-indigo-100 text-indigo-900 border-indigo-200',
    accentClass: 'border-indigo-200 bg-indigo-50 text-indigo-950',
  },
] as const;

const BY_CODE: Record<DocumentTypeCode, DocumentTypeMeta> = DOCUMENT_TYPES.reduce(
  (acc, item) => {
    acc[item.code] = item;
    return acc;
  },
  {} as Record<DocumentTypeCode, DocumentTypeMeta>
);

export function isDocumentTypeCode(value: unknown): value is DocumentTypeCode {
  return typeof value === 'string' && (DOCUMENT_TYPE_CODES as readonly string[]).includes(value);
}

export function getDocumentTypeMeta(code: string | null | undefined): DocumentTypeMeta {
  if (code && isDocumentTypeCode(code)) {
    return BY_CODE[code];
  }
  return BY_CODE.OTHER;
}

/**
 * Suy ra loại đơn từ mã thủ tục / formCode đã có trong hệ thống.
 * Ưu tiên khớp chính xác, sau đó theo tiền tố / từ khóa.
 */
export function inferDocumentType(procedureOrFormCode: string | null | undefined): DocumentTypeCode {
  if (!procedureOrFormCode) {
    return 'OTHER';
  }
  const code = procedureOrFormCode.trim().toUpperCase();
  if (isDocumentTypeCode(code)) {
    return code;
  }

  if (
    code.includes('MARRIAGE') ||
    code.includes('KET_HON') ||
    code.includes('KETHON') ||
    code === 'DKKH'
  ) {
    return 'MARRIAGE_REGISTRATION';
  }
  if (code.includes('DIVORCE') || code.includes('LY_HON') || code.includes('LYHON')) {
    return 'DIVORCE_APPLICATION';
  }
  if (code.includes('BIRTH') || code.includes('KHAI_SINH') || code.includes('KHAISINH')) {
    return 'BIRTH_CERTIFICATE';
  }
  if (code.includes('DEATH') || code.includes('KHAI_TU') || code.includes('KHAITU')) {
    return 'DEATH_CERTIFICATE';
  }
  if (
    code.includes('TEMPORARY') ||
    code.includes('RESIDENCE') ||
    code.includes('TAM_TRU') ||
    code.includes('TAM_VANG') ||
    code.includes('TAMTRU') ||
    code.includes('TAMVANG') ||
    code.includes('CU_TRU')
  ) {
    return 'TEMPORARY_RESIDENCE';
  }
  if (
    code.includes('MARITAL_STATUS') ||
    code.includes('SINGLE_STATUS') ||
    code.includes('TINH_TRANG_HON_NHAN') ||
    code.includes('XAC_NHAN_HON_NHAN')
  ) {
    return 'MARITAL_STATUS_CONFIRMATION';
  }
  if (
    code.includes('AUTHENTIC') ||
    code.includes('NOTAR') ||
    code.includes('CHUNG_THUC') ||
    code.includes('CHUNGTHUC') ||
    code.includes('SAO_Y')
  ) {
    return 'DOCUMENT_AUTHENTICATION';
  }

  return 'OTHER';
}

export function parseDocumentTypeInput(value: unknown): DocumentTypeCode | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim().toUpperCase();
  return isDocumentTypeCode(trimmed) ? trimmed : null;
}
