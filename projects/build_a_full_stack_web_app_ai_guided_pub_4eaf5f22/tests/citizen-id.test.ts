import { describe, expect, it } from 'vitest';
import { parseCitizenIdQr } from '@/lib/citizen-id';

describe('Vietnamese citizen ID QR parsing', () => {
  it('parses the common pipe-separated chip-card payload', () => {
    expect(
      parseCitizenIdQr(
        '079095001234|025123456|NGUYỄN VĂN AN|15061995|Nam|12 Nguyễn Huệ, TP.HCM|01072021'
      )
    ).toEqual({
      citizenId: '079095001234',
      displayName: 'NGUYỄN VĂN AN',
      dateOfBirth: '1995-06-15',
      gender: 'Nam',
      address: '12 Nguyễn Huệ, TP.HCM',
      idIssuedAt: '2021-07-01',
    });
  });

  it('parses a labeled bilingual payload', () => {
    expect(
      parseCitizenIdQr(
        [
          'Số định danh cá nhân: 079095001234',
          'Họ và tên: Nguyễn Văn An',
          'Ngày sinh: 15/06/1995',
          'Giới tính: Nam',
          'Nơi cư trú: 12 Nguyễn Huệ, TP.HCM',
          'Ngày hết hạn: 15/06/2035',
        ].join('\n')
      )
    ).toMatchObject({
      citizenId: '079095001234',
      displayName: 'Nguyễn Văn An',
      dateOfBirth: '1995-06-15',
      gender: 'Nam',
      address: '12 Nguyễn Huệ, TP.HCM',
      idExpiresAt: '2035-06-15',
    });
  });

  it('rejects unrelated QR content', () => {
    expect(parseCitizenIdQr('https://example.com/not-an-id')).toBeNull();
  });
});
