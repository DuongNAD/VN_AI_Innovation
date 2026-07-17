export const DISCLAIMER: string = 'Thông tin chỉ mang tính hướng dẫn, không thay thế văn bản pháp luật hiện hành. Vui lòng đối chiếu với nguồn chính thức trước khi nộp hồ sơ.';

export const PROVINCES: readonly string[] = [
  'Hà Nội',
  'TP. Hồ Chí Minh',
  'Hải Phòng',
  'Đà Nẵng',
  'Cần Thơ',
  'Huế',
  'Lai Châu',
  'Điện Biên',
  'Sơn La',
  'Lạng Sơn',
  'Cao Bằng',
  'Tuyên Quang',
  'Lào Cai',
  'Thái Nguyên',
  'Phú Thọ',
  'Bắc Ninh',
  'Hưng Yên',
  'Ninh Bình',
  'Quảng Ninh',
  'Thanh Hóa',
  'Nghệ An',
  'Hà Tĩnh',
  'Quảng Trị',
  'Quảng Ngãi',
  'Gia Lai',
  'Khánh Hòa',
  'Lâm Đồng',
  'Đắk Lắk',
  'Đồng Nai',
  'Tây Ninh',
  'Vĩnh Long',
  'Đồng Tháp',
  'An Giang',
  'Cà Mau'
] as const;

export const LIMITS = {
  JSON_BODY_MAX_BYTES: 1048576,
  AUDIO_MAX_BYTES: 10485760,
  AUDIO_PREPARSE_MAX_BYTES: 11534336,
  AUDIO_MAX_SECONDS: 60,
  TTS_TEXT_MAX: 5000,
  ANSWER_TEXT_MAX: 500,
  FIELD_VALUE_MAX: 2000
} as const;
