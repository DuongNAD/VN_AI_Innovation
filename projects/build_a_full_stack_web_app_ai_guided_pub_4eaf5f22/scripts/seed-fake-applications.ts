/**
 * Seed fake officer-queue applications for local demo / UI testing.
 *
 * Fixes:
 * - Each documentType gets its OWN form code (not falling back to BIRTH_REGISTRATION).
 * - dataJson keys match the form version field ids so the manager table shows values.
 *
 * Usage (from project root):
 *   npx tsx scripts/seed-fake-applications.ts
 *
 * Safe to re-run: removes previous rows tagged with dataJson.__seedFake === true.
 */
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import {
  DOCUMENT_TYPE_CODES,
  getDocumentTypeMeta,
  type DocumentTypeCode,
} from '../src/lib/document-types';
import { hashToken } from '../src/lib/auth';

const prisma = new PrismaClient();

type FieldDefLite = {
  id: string;
  type?: string;
  label?: string;
  required?: boolean;
  options?: { value: unknown; label: string }[];
};

type FakeSpec = {
  documentType: DocumentTypeCode;
  status: 'SUBMITTED' | 'APPROVED' | 'RETURNED';
  person: string;
  person2?: string;
  note?: string;
  hoursAgo: number;
};

/** Canonical form code for each classification (1:1 with documentType). */
const FORM_CODE_BY_TYPE: Record<DocumentTypeCode, string> = {
  MARRIAGE_REGISTRATION: 'MARRIAGE_REGISTRATION',
  DIVORCE_APPLICATION: 'DIVORCE_APPLICATION',
  BIRTH_CERTIFICATE: 'BIRTH_REGISTRATION',
  DEATH_CERTIFICATE: 'DEATH_REGISTRATION',
  TEMPORARY_RESIDENCE: 'TEMP_RESIDENCE_REGISTRATION',
  MARITAL_STATUS_CONFIRMATION: 'MARITAL_STATUS_CONFIRMATION',
  DOCUMENT_AUTHENTICATION: 'DOCUMENT_AUTHENTICATION',
  OTHER: 'GENERAL_ADMIN_APPLICATION',
};

const PROCEDURE_NAME_BY_TYPE: Record<DocumentTypeCode, string> = {
  MARRIAGE_REGISTRATION: 'Đăng ký kết hôn',
  DIVORCE_APPLICATION: 'Giải quyết ly hôn',
  BIRTH_CERTIFICATE: 'Đăng ký khai sinh',
  DEATH_CERTIFICATE: 'Đăng ký khai tử',
  TEMPORARY_RESIDENCE: 'Đăng ký tạm trú',
  MARITAL_STATUS_CONFIRMATION: 'Xác nhận tình trạng hôn nhân',
  DOCUMENT_AUTHENTICATION: 'Chứng thực giấy tờ',
  OTHER: 'Thủ tục hành chính khác',
};

/** Default field schemas for demo forms that may not exist in the main seed. */
const DEMO_FIELDS: Record<DocumentTypeCode, FieldDefLite[]> = {
  MARRIAGE_REGISTRATION: [
    { id: 'male_full_name', type: 'text', label: 'Họ và tên nam', required: true },
    { id: 'male_birth_date', type: 'date', label: 'Ngày sinh nam', required: true },
    { id: 'male_identity_number', type: 'text', label: 'CCCD nam', required: true },
    { id: 'female_full_name', type: 'text', label: 'Họ và tên nữ', required: true },
    { id: 'female_birth_date', type: 'date', label: 'Ngày sinh nữ', required: true },
    { id: 'female_identity_number', type: 'text', label: 'CCCD nữ', required: true },
    { id: 'residence', type: 'text', label: 'Nơi cư trú', required: true },
    { id: 'province', type: 'province', label: 'Tỉnh/thành phố đăng ký', required: true },
    {
      id: 'previously_married',
      type: 'radio',
      label: 'Đã từng kết hôn chưa',
      required: true,
      options: [
        { value: true, label: 'Có' },
        { value: false, label: 'Chưa' },
      ],
    },
    {
      id: 'submission_channel',
      type: 'radio',
      label: 'Kênh nộp hồ sơ',
      required: true,
      options: [
        { value: 'online', label: 'Trực tuyến' },
        { value: 'offline', label: 'Trực tiếp' },
      ],
    },
  ],
  DIVORCE_APPLICATION: [
    { id: 'petitioner_name', type: 'text', label: 'Họ và tên người nộp đơn', required: true },
    { id: 'petitioner_identity', type: 'text', label: 'CCCD người nộp', required: true },
    { id: 'spouse_name', type: 'text', label: 'Họ và tên vợ/chồng', required: true },
    { id: 'spouse_identity', type: 'text', label: 'CCCD vợ/chồng', required: true },
    { id: 'marriage_certificate_no', type: 'text', label: 'Số giấy chứng nhận kết hôn', required: true },
    { id: 'marriage_date', type: 'date', label: 'Ngày kết hôn', required: true },
    {
      id: 'divorce_type',
      type: 'select',
      label: 'Hình thức ly hôn',
      required: true,
      options: [
        { value: 'mutual', label: 'Thuận tình' },
        { value: 'unilateral', label: 'Đơn phương' },
      ],
    },
    { id: 'reason', type: 'text', label: 'Lý do', required: true },
    { id: 'province', type: 'province', label: 'Tỉnh/thành phố', required: true },
  ],
  BIRTH_CERTIFICATE: [
    { id: 'child_name', type: 'text', label: 'Họ và tên trẻ', required: true },
    { id: 'birth_date', type: 'date', label: 'Ngày sinh của trẻ', required: true },
    { id: 'province', type: 'province', label: 'Tỉnh/thành phố đăng ký', required: true },
    { id: 'requester_name', type: 'text', label: 'Họ và tên người đi khai sinh', required: true },
    {
      id: 'relationship',
      type: 'select',
      label: 'Quan hệ với trẻ',
      required: true,
      options: [
        { value: 'father', label: 'Cha' },
        { value: 'mother', label: 'Mẹ' },
        { value: 'other', label: 'Khác' },
      ],
    },
  ],
  DEATH_CERTIFICATE: [
    { id: 'deceased_name', type: 'text', label: 'Họ và tên người mất', required: true },
    { id: 'death_date', type: 'date', label: 'Ngày mất', required: true },
    { id: 'death_place', type: 'text', label: 'Nơi mất', required: true },
    { id: 'requester_name', type: 'text', label: 'Họ và tên người khai tử', required: true },
    { id: 'requester_identity', type: 'text', label: 'CCCD người khai', required: true },
    { id: 'relationship', type: 'text', label: 'Quan hệ với người mất', required: true },
    { id: 'province', type: 'province', label: 'Tỉnh/thành phố đăng ký', required: true },
  ],
  TEMPORARY_RESIDENCE: [
    { id: 'full_name', type: 'text', label: 'Họ và tên', required: true },
    { id: 'birth_date', type: 'date', label: 'Ngày sinh', required: true },
    {
      id: 'gender',
      type: 'radio',
      label: 'Giới tính',
      required: true,
      options: [
        { value: 'male', label: 'Nam' },
        { value: 'female', label: 'Nữ' },
      ],
    },
    { id: 'identity_number', type: 'text', label: 'CCCD', required: true },
    { id: 'phone_number', type: 'text', label: 'Số điện thoại', required: true },
    { id: 'permanent_address', type: 'text', label: 'Nơi thường trú', required: true },
    { id: 'temporary_address', type: 'text', label: 'Nơi đăng ký tạm trú', required: true },
    { id: 'temp_from_date', type: 'date', label: 'Tạm trú từ ngày', required: true },
    { id: 'temp_to_date', type: 'date', label: 'Tạm trú đến ngày', required: true },
    { id: 'relationship_to_owner', type: 'text', label: 'Quan hệ với chủ hộ', required: true },
    {
      id: 'host_consent',
      type: 'radio',
      label: 'Chủ hộ đồng ý',
      required: true,
      options: [
        { value: true, label: 'Có' },
        { value: false, label: 'Không' },
      ],
    },
    { id: 'province', type: 'province', label: 'Tỉnh/thành phố đăng ký', required: true },
  ],
  MARITAL_STATUS_CONFIRMATION: [
    { id: 'full_name', type: 'text', label: 'Họ và tên', required: true },
    { id: 'birth_date', type: 'date', label: 'Ngày sinh', required: true },
    { id: 'identity_number', type: 'text', label: 'CCCD', required: true },
    { id: 'permanent_address', type: 'text', label: 'Nơi thường trú', required: true },
    {
      id: 'marital_status',
      type: 'select',
      label: 'Tình trạng hôn nhân',
      required: true,
      options: [
        { value: 'single', label: 'Chưa kết hôn' },
        { value: 'divorced', label: 'Đã ly hôn' },
        { value: 'widowed', label: 'Góa' },
      ],
    },
    { id: 'purpose', type: 'text', label: 'Mục đích sử dụng', required: true },
    { id: 'province', type: 'province', label: 'Tỉnh/thành phố cấp giấy', required: true },
  ],
  DOCUMENT_AUTHENTICATION: [
    { id: 'requester_name', type: 'text', label: 'Họ và tên người yêu cầu', required: true },
    { id: 'identity_number', type: 'text', label: 'CCCD', required: true },
    { id: 'phone_number', type: 'text', label: 'Số điện thoại', required: true },
    {
      id: 'document_kind',
      type: 'select',
      label: 'Loại giấy tờ chứng thực',
      required: true,
      options: [
        { value: 'copy', label: 'Chứng thực bản sao' },
        { value: 'signature', label: 'Chứng thực chữ ký' },
        { value: 'contract', label: 'Chứng thực hợp đồng' },
      ],
    },
    { id: 'document_title', type: 'text', label: 'Tên giấy tờ', required: true },
    { id: 'copies', type: 'number', label: 'Số bản', required: true },
    { id: 'province', type: 'province', label: 'Tỉnh/thành phố', required: true },
  ],
  OTHER: [
    { id: 'full_name', type: 'text', label: 'Họ và tên', required: true },
    { id: 'identity_number', type: 'text', label: 'CCCD', required: true },
    { id: 'phone_number', type: 'text', label: 'Số điện thoại', required: true },
    { id: 'subject', type: 'text', label: 'Nội dung đề nghị', required: true },
    { id: 'address', type: 'text', label: 'Địa chỉ liên hệ', required: true },
    { id: 'province', type: 'province', label: 'Tỉnh/thành phố', required: true },
  ],
};

/** Base fixtures — expanded further by generateExtraSpecs() for bulk testing. */
const BASE_SPECS: FakeSpec[] = [
  // —— Kết hôn
  { documentType: 'MARRIAGE_REGISTRATION', status: 'SUBMITTED', person: 'Nguyễn Văn An', person2: 'Trần Thị Bình', hoursAgo: 2 },
  { documentType: 'MARRIAGE_REGISTRATION', status: 'SUBMITTED', person: 'Phạm Đức Thành', person2: 'Lê Thị Hương', hoursAgo: 7 },
  { documentType: 'MARRIAGE_REGISTRATION', status: 'SUBMITTED', person: 'Hoàng Minh Tuấn', person2: 'Vũ Thị Ngọc', hoursAgo: 14 },
  { documentType: 'MARRIAGE_REGISTRATION', status: 'APPROVED', person: 'Lê Minh Cường', person2: 'Phạm Thu Dung', hoursAgo: 26 },
  { documentType: 'MARRIAGE_REGISTRATION', status: 'APPROVED', person: 'Đỗ Quang Huy', person2: 'Mai Thị Yến', hoursAgo: 50 },
  { documentType: 'MARRIAGE_REGISTRATION', status: 'RETURNED', person: 'Trần Quốc Bảo', person2: 'Nguyễn Thị Hà', note: 'CCCD bên nữ bị mờ — chụp lại trang thông tin.', hoursAgo: 18 },
  // —— Ly hôn
  { documentType: 'DIVORCE_APPLICATION', status: 'SUBMITTED', person: 'Hoàng Văn Em', person2: 'Ngô Thị Hoa', hoursAgo: 5 },
  { documentType: 'DIVORCE_APPLICATION', status: 'SUBMITTED', person: 'Lý Văn Phúc', person2: 'Đinh Thị Thảo', hoursAgo: 11 },
  { documentType: 'DIVORCE_APPLICATION', status: 'SUBMITTED', person: 'Cao Minh Đức', person2: 'Bùi Thị Kim', hoursAgo: 22 },
  { documentType: 'DIVORCE_APPLICATION', status: 'RETURNED', person: 'Võ Thị Phương', person2: 'Đặng Văn Sơn', note: 'Thiếu bản sao Giấy chứng nhận kết hôn và CCCD của cả hai bên.', hoursAgo: 30 },
  { documentType: 'DIVORCE_APPLICATION', status: 'RETURNED', person: 'Phan Văn Toàn', person2: 'Lâm Thị My', note: 'Bổ sung thỏa thuận phân chia tài sản có công chứng.', hoursAgo: 42 },
  { documentType: 'DIVORCE_APPLICATION', status: 'APPROVED', person: 'Trương Văn Nam', person2: 'Hồ Thị Loan', hoursAgo: 72 },
  // —— Khai sinh
  { documentType: 'BIRTH_CERTIFICATE', status: 'SUBMITTED', person: 'Nguyễn Gia Bảo', person2: 'Nguyễn Văn Khoa', hoursAgo: 1 },
  { documentType: 'BIRTH_CERTIFICATE', status: 'SUBMITTED', person: 'Lê Khánh Chi', person2: 'Lê Thị Mai', hoursAgo: 6 },
  { documentType: 'BIRTH_CERTIFICATE', status: 'SUBMITTED', person: 'Trần Gia Hân', person2: 'Trần Văn Hùng', hoursAgo: 9 },
  { documentType: 'BIRTH_CERTIFICATE', status: 'SUBMITTED', person: 'Phạm Bảo Long', person2: 'Phạm Thị Oanh', hoursAgo: 16 },
  { documentType: 'BIRTH_CERTIFICATE', status: 'APPROVED', person: 'Trần Minh Khang', person2: 'Trần Thị Lan', hoursAgo: 48 },
  { documentType: 'BIRTH_CERTIFICATE', status: 'RETURNED', person: 'Vũ An Nhiên', person2: 'Vũ Thị Hằng', note: 'Thiếu giấy chứng sinh do cơ sở y tế cấp.', hoursAgo: 28 },
  // —— Khai tử
  { documentType: 'DEATH_CERTIFICATE', status: 'SUBMITTED', person: 'Phạm Văn Long', person2: 'Phạm Thị Mai', hoursAgo: 8 },
  { documentType: 'DEATH_CERTIFICATE', status: 'SUBMITTED', person: 'Nguyễn Thị Bảy', person2: 'Nguyễn Văn Tám', hoursAgo: 15 },
  { documentType: 'DEATH_CERTIFICATE', status: 'SUBMITTED', person: 'Lê Văn Chín', person2: 'Lê Thị Mười', hoursAgo: 19 },
  { documentType: 'DEATH_CERTIFICATE', status: 'APPROVED', person: 'Đặng Văn Hùng', person2: 'Đặng Thị Lan', hoursAgo: 55 },
  { documentType: 'DEATH_CERTIFICATE', status: 'RETURNED', person: 'Bùi Văn Cường', person2: 'Bùi Thị Duyên', note: 'Bổ sung giấy báo tử / giấy xác nhận của bệnh viện.', hoursAgo: 33 },
  // —— Tạm trú
  { documentType: 'TEMPORARY_RESIDENCE', status: 'SUBMITTED', person: 'Đỗ Thị Mai', hoursAgo: 4 },
  { documentType: 'TEMPORARY_RESIDENCE', status: 'SUBMITTED', person: 'Nguyễn Văn Kiên', hoursAgo: 10 },
  { documentType: 'TEMPORARY_RESIDENCE', status: 'SUBMITTED', person: 'Lê Thị Phương', hoursAgo: 13 },
  { documentType: 'TEMPORARY_RESIDENCE', status: 'SUBMITTED', person: 'Hoàng Đức Anh', hoursAgo: 21 },
  { documentType: 'TEMPORARY_RESIDENCE', status: 'RETURNED', person: 'Bùi Quốc Huy', note: 'Bổ sung giấy tờ chứng minh chỗ ở và thời gian tạm trú.', hoursAgo: 20 },
  { documentType: 'TEMPORARY_RESIDENCE', status: 'APPROVED', person: 'Trần Thị Quỳnh', hoursAgo: 64 },
  // —— Xác nhận tình trạng hôn nhân
  { documentType: 'MARITAL_STATUS_CONFIRMATION', status: 'SUBMITTED', person: 'Ngô Thanh Hà', hoursAgo: 3 },
  { documentType: 'MARITAL_STATUS_CONFIRMATION', status: 'SUBMITTED', person: 'Đinh Thị Thu', hoursAgo: 8 },
  { documentType: 'MARITAL_STATUS_CONFIRMATION', status: 'SUBMITTED', person: 'Mai Văn Sơn', hoursAgo: 17 },
  { documentType: 'MARITAL_STATUS_CONFIRMATION', status: 'APPROVED', person: 'Lâm Thị Vân', hoursAgo: 45 },
  { documentType: 'MARITAL_STATUS_CONFIRMATION', status: 'RETURNED', person: 'Phùng Văn Đạt', note: 'Ghi rõ mục đích sử dụng giấy xác nhận (đăng ký kết hôn / xuất cảnh…).', hoursAgo: 25 },
  // —— Chứng thực
  { documentType: 'DOCUMENT_AUTHENTICATION', status: 'SUBMITTED', person: 'Phan Văn Khoa', hoursAgo: 6 },
  { documentType: 'DOCUMENT_AUTHENTICATION', status: 'SUBMITTED', person: 'Nguyễn Thị Xuân', hoursAgo: 12 },
  { documentType: 'DOCUMENT_AUTHENTICATION', status: 'SUBMITTED', person: 'Võ Minh Nhật', hoursAgo: 23 },
  { documentType: 'DOCUMENT_AUTHENTICATION', status: 'APPROVED', person: 'Lý Thị Lan', hoursAgo: 40 },
  { documentType: 'DOCUMENT_AUTHENTICATION', status: 'RETURNED', person: 'Châu Văn Bình', note: 'Mang theo bản chính để đối chiếu khi chứng thực bản sao.', hoursAgo: 35 },
  // —— Khác
  { documentType: 'OTHER', status: 'SUBMITTED', person: 'Trịnh Minh Tuấn', hoursAgo: 12 },
  { documentType: 'OTHER', status: 'SUBMITTED', person: 'Hà Thị Linh', hoursAgo: 18 },
  { documentType: 'OTHER', status: 'APPROVED', person: 'Đặng Thu Trang', hoursAgo: 60 },
  { documentType: 'OTHER', status: 'RETURNED', person: 'Ông Văn Tài', note: 'Mô tả rõ hơn nội dung đề nghị và đính kèm giấy tờ liên quan.', hoursAgo: 29 },
];

const FIRST_NAMES = [
  'An', 'Bình', 'Châu', 'Dũng', 'Em', 'Giang', 'Hà', 'Hùng', 'Khoa', 'Lan',
  'Minh', 'Nam', 'Oanh', 'Phúc', 'Quân', 'Sơn', 'Tâm', 'Uyên', 'Vân', 'Yến',
  'Ánh', 'Bảo', 'Cường', 'Duy', 'Hạnh', 'Khánh', 'Linh', 'My', 'Ngọc', 'Trang',
];
const MIDDLE = ['Văn', 'Thị', 'Minh', 'Đức', 'Hoàng', 'Thanh', 'Quốc', 'Kim'];
const LAST = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương'];

function randomPerson(i: number): string {
  const last = LAST[i % LAST.length];
  const mid = MIDDLE[i % MIDDLE.length];
  const first = FIRST_NAMES[i % FIRST_NAMES.length];
  return `${last} ${mid} ${first}`;
}

/** Extra bulk rows so every type has more pending work for the officer queue. */
function generateExtraSpecs(): FakeSpec[] {
  const types = DOCUMENT_TYPE_CODES;
  const out: FakeSpec[] = [];
  let n = 0;
  for (const documentType of types) {
    // 3 thêm CHỜ DUYỆT mỗi loại
    for (let k = 0; k < 3; k++) {
      n++;
      out.push({
        documentType,
        status: 'SUBMITTED',
        person: randomPerson(n * 3),
        person2: randomPerson(n * 3 + 1),
        hoursAgo: 1 + ((n + k) % 40),
      });
    }
    // 1 thêm ĐÃ DUYỆT
    n++;
    out.push({
      documentType,
      status: 'APPROVED',
      person: randomPerson(n * 5),
      person2: randomPerson(n * 5 + 2),
      hoursAgo: 48 + (n % 20),
    });
    // 1 thêm CẦN BỔ SUNG
    n++;
    out.push({
      documentType,
      status: 'RETURNED',
      person: randomPerson(n * 7),
      person2: randomPerson(n * 7 + 1),
      note: 'Vui lòng kiểm tra lại thông tin khai báo và bổ sung giấy tờ còn thiếu.',
      hoursAgo: 24 + (n % 15),
    });
  }
  return out;
}

const SPECS: FakeSpec[] = [...BASE_SPECS, ...generateExtraSpecs()];

function cid(): string {
  return '0' + String(Math.floor(10000000000 + Math.random() * 89999999999));
}

function phone(): string {
  return '09' + String(Math.floor(10000000 + Math.random() * 89999999));
}

function parseFieldsFromSchema(schemaJson: unknown): FieldDefLite[] {
  if (!schemaJson || typeof schemaJson !== 'object') return [];
  const fields = (schemaJson as { fields?: unknown }).fields;
  if (!Array.isArray(fields)) return [];
  const out: FieldDefLite[] = [];
  for (const f of fields) {
    if (!f || typeof f !== 'object') continue;
    const row = f as Record<string, unknown>;
    if (typeof row.id !== 'string' || !row.id) continue;
    out.push({
      id: row.id,
      type: typeof row.type === 'string' ? row.type : 'text',
      label: typeof row.label === 'string' ? row.label : row.id,
      required: row.required === true,
      options: Array.isArray(row.options)
        ? (row.options as { value: unknown; label: string }[])
        : undefined,
    });
  }
  return out;
}

/** Build dataJson values that match the actual field ids of the form version. */
function buildDataForFields(
  fields: FieldDefLite[],
  spec: FakeSpec
): Record<string, unknown> {
  const person = spec.person;
  const person2 = spec.person2 ?? 'Nguyễn Thị Demo';
  const data: Record<string, unknown> = { __seedFake: true };

  const defaults: Record<string, unknown> = {
    // Marriage
    male_full_name: person,
    male_birth_date: '1995-03-15',
    male_identity_number: cid(),
    female_full_name: person2,
    female_birth_date: '1997-08-20',
    female_identity_number: cid(),
    residence: '12 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',
    permanent_address: '12 Nguyễn Huệ, Quận 1, TP. Hồ Chí Minh',
    temporary_address: '45 Lê Lợi, Quận 1, TP. Hồ Chí Minh',
    phone_number: phone(),
    previously_married: false,
    submission_channel: 'online',
    // Divorce
    petitioner_name: person,
    petitioner_identity: cid(),
    spouse_name: person2,
    spouse_identity: cid(),
    marriage_certificate_no: 'GCN-KH-2020-00' + Math.floor(100 + Math.random() * 899),
    marriage_date: '2020-06-12',
    divorce_type: 'mutual',
    reason: 'Hai bên thuận tình ly hôn, không tranh chấp tài sản.',
    // Birth
    child_name: person.replace(/^Trẻ:\s*/i, ''),
    birth_date: '2025-11-02',
    requester_name: person2,
    relationship: 'mother',
    // Death
    deceased_name: person.replace(/^Người mất:\s*/i, ''),
    death_date: '2026-05-01',
    death_place: 'Bệnh viện Chợ Rẫy, TP. Hồ Chí Minh',
    requester_identity: cid(),
    // Residence
    full_name: person,
    gender: 'female',
    identity_number: cid(),
    temp_from_date: '2026-07-01',
    temp_to_date: '2026-12-31',
    relationship_to_owner: 'Thuê nhà',
    host_consent: true,
    // Marital status
    marital_status: 'single',
    purpose: 'Làm thủ tục đăng ký kết hôn',
    // Authentication
    document_kind: 'copy',
    document_title: 'Bằng tốt nghiệp đại học',
    copies: 2,
    // Other
    subject: 'Đề nghị hướng dẫn thủ tục hành chính',
    address: '123 Đường Demo, Phường 1, Quận 1, TP. Hồ Chí Minh',
    phone: phone(),
    province: '79', // HCMC common code in many seeds; fallback string ok for display
    note: `Hồ sơ demo — ${spec.documentType}`,
  };

  for (const field of fields) {
    if (field.id.startsWith('__')) continue;

    if (defaults[field.id] !== undefined) {
      data[field.id] = defaults[field.id];
      continue;
    }

    // Option fields: pick first option
    if (field.options && field.options.length > 0) {
      data[field.id] = field.options[0].value;
      continue;
    }

    switch (field.type) {
      case 'date':
        data[field.id] = '2024-01-15';
        break;
      case 'number':
        data[field.id] = 1;
        break;
      case 'file':
        // leave empty — files not needed for officer table
        break;
      case 'province':
        data[field.id] = '79';
        break;
      case 'radio':
      case 'select':
        data[field.id] = 'other';
        break;
      default:
        // Prefer name-like labels
        if (/tên|name/i.test(field.label ?? field.id)) {
          data[field.id] = person;
        } else if (/cccd|định danh|identity/i.test(field.label ?? field.id)) {
          data[field.id] = cid();
        } else if (/điện thoại|phone/i.test(field.label ?? field.id)) {
          data[field.id] = phone();
        } else if (/địa chỉ|address|cư trú|residence/i.test(field.label ?? field.id)) {
          data[field.id] = '123 Đường Demo, Phường 1, Quận 1, TP. Hồ Chí Minh';
        } else {
          data[field.id] = `Giá trị demo (${field.label ?? field.id})`;
        }
    }
  }

  return data;
}

/**
 * Ensure Procedure + Form + ACTIVE FormVersion exist for this document type.
 * Returns formVersion id + form code + field defs for data generation.
 */
async function ensureFormForType(documentType: DocumentTypeCode): Promise<{
  formVersionId: string;
  formCode: string;
  fields: FieldDefLite[];
}> {
  const formCode = FORM_CODE_BY_TYPE[documentType];
  const procName = PROCEDURE_NAME_BY_TYPE[documentType];
  const meta = getDocumentTypeMeta(documentType);

  // Always ensure Procedure + ACTIVE ProcedureVersion so staff APIs that call
  // getProcedure(formCode) do not throw DATA_INTEGRITY.
  const procedure = await prisma.procedure.upsert({
    where: { code: formCode },
    create: {
      code: formCode,
      name: procName,
      sector: 'Tư pháp - Hộ tịch',
      agency: 'UBND cấp xã (demo seed)',
      audience: 'CITIZEN',
      sourceUrl: 'https://dichvucong.gov.vn/',
      lastCheckedAt: new Date(),
    },
    update: {
      name: procName,
      lastCheckedAt: new Date(),
    },
  });

  const activeProcVer = await prisma.procedureVersion.findFirst({
    where: { procedureId: procedure.id, status: 'ACTIVE' },
  });
  if (!activeProcVer) {
    await prisma.procedureVersion.create({
      data: {
        procedureId: procedure.id,
        version: '1.0-demo',
        status: 'ACTIVE',
        effectiveFrom: new Date('2026-01-01T00:00:00+07:00'),
        stepsJson: [
          {
            order: 1,
            title: 'Nộp hồ sơ',
            description: 'Nộp hồ sơ demo qua cổng trực tuyến.',
          },
        ],
        durationText: '3–5 ngày làm việc (demo)',
        feesText: 'Theo quy định (demo)',
        legalBasisText: 'Dữ liệu seed demo — không dùng cho vận hành thật.',
      },
    });
  }

  // Prefer existing ACTIVE form version
  const existing = await prisma.formVersion.findFirst({
    where: {
      status: 'ACTIVE',
      form: { code: formCode },
    },
    include: { form: true },
    orderBy: { version: 'desc' },
  });

  if (existing) {
    const fields = parseFieldsFromSchema(existing.schemaJson);
    if (fields.length > 0) {
      // Keep form linked to the correct procedure name
      await prisma.form.update({
        where: { id: existing.formId },
        data: { name: meta.label, procedureId: procedure.id },
      });
      return { formVersionId: existing.id, formCode, fields };
    }
  }

  const form = await prisma.form.upsert({
    where: { code: formCode },
    create: {
      code: formCode,
      procedureId: procedure.id,
      name: meta.label,
      revision: 0,
    },
    update: {
      name: meta.label,
      procedureId: procedure.id,
    },
  });

  const fields = DEMO_FIELDS[documentType];
  const schemaJson = { fields, migrationHints: [] };

  // Upsert ACTIVE v1.0 demo
  const current = await prisma.formVersion.findFirst({
    where: { formId: form.id, version: '1.0-demo' },
  });

  let formVersionId: string;
  if (current) {
    await prisma.formVersion.update({
      where: { id: current.id },
      data: {
        status: 'ACTIVE',
        schemaJson,
        effectiveFrom: new Date('2026-01-01T00:00:00+07:00'),
      },
    });
    formVersionId = current.id;
  } else {
    // Retire other actives for this form so getActive is unambiguous
    await prisma.formVersion.updateMany({
      where: { formId: form.id, status: 'ACTIVE' },
      data: { status: 'RETIRED' },
    });
    const created = await prisma.formVersion.create({
      data: {
        formId: form.id,
        version: '1.0-demo',
        status: 'ACTIVE',
        effectiveFrom: new Date('2026-01-01T00:00:00+07:00'),
        schemaJson,
      },
    });
    formVersionId = created.id;
  }

  return { formVersionId, formCode, fields };
}

async function main() {
  // Cleanup previous fake applications + sessions
  const allApps = await prisma.application.findMany({
    select: { id: true, sessionId: true, dataJson: true },
  });
  const fakeApps = allApps.filter((a) => {
    const d = a.dataJson as Record<string, unknown> | null;
    return d && typeof d === 'object' && d.__seedFake === true;
  });
  const sessionIds = [...new Set(fakeApps.map((a) => a.sessionId))];
  if (fakeApps.length > 0) {
    await prisma.application.deleteMany({ where: { id: { in: fakeApps.map((a) => a.id) } } });
    await prisma.session.deleteMany({ where: { id: { in: sessionIds } } });
    console.log(`Removed ${fakeApps.length} previous fake application(s).`);
  } else {
    console.log('No previous fake applications found.');
  }

  // Prepare form targets per document type
  const formByType = new Map<
    DocumentTypeCode,
    { formVersionId: string; formCode: string; fields: FieldDefLite[] }
  >();
  for (const code of DOCUMENT_TYPE_CODES) {
    const target = await ensureFormForType(code);
    formByType.set(code, target);
    console.log(
      `Form ready: ${code} -> ${target.formCode} (${target.fields.length} fields, fv=${target.formVersionId.slice(0, 8)}…)`
    );
  }

  let created = 0;
  const summary: Record<string, number> = {};

  for (const spec of SPECS) {
    const target = formByType.get(spec.documentType);
    if (!target) {
      console.warn(`Skip ${spec.documentType}: no form`);
      continue;
    }

    const dataJson = buildDataForFields(target.fields, spec);
    const token = crypto.randomBytes(24).toString('base64url');
    const tokenHash = hashToken(token);
    const submittedAt = new Date(Date.now() - spec.hoursAgo * 3600 * 1000);
    const reviewedAt =
      spec.status === 'SUBMITTED' ? null : new Date(submittedAt.getTime() + 2 * 3600 * 1000);

    const session = await prisma.session.create({
      data: {
        accessTokenHash: tokenHash,
        procedureCode: target.formCode,
        intent: `fake:${spec.documentType}`,
        answersJson: { __seedFake: true },
        currentStep: 99,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });

    await prisma.application.create({
      data: {
        sessionId: session.id,
        formVersionId: target.formVersionId,
        status: spec.status,
        documentType: spec.documentType,
        dataJson,
        revision: 1,
        submittedAt,
        reviewedAt,
        reviewedBy: reviewedAt ? 'Cán bộ Demo (seed)' : null,
        reviewNote:
          spec.note ?? (spec.status === 'APPROVED' ? 'Hồ sơ hợp lệ — duyệt demo.' : null),
      },
    });

    created++;
    const key = `${spec.documentType}:${spec.status}`;
    summary[key] = (summary[key] ?? 0) + 1;

    const filled = Object.keys(dataJson).filter((k) => k !== '__seedFake').length;
    console.log(
      `+ ${spec.documentType.padEnd(30)} ${spec.status.padEnd(10)} form=${target.formCode.padEnd(28)} fields=${filled} · ${spec.person}`
    );
  }

  console.log('\nDone.');
  console.log(`Created ${created} fake applications.`);
  console.log('Breakdown:', summary);
  console.log('Open /manager and click "Làm mới dữ liệu".');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
