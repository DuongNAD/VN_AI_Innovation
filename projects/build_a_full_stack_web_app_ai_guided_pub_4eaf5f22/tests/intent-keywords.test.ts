import { describe, it, expect } from 'vitest';
import { classifyByKeywords } from '@/lib/ai/llm';

describe('mock classifier · business intents', () => {
  it.each([
    ['Tôi muốn đăng ký hộ kinh doanh', 'HOUSEHOLD_BUSINESS_REGISTRATION'],
    ['Tôi muốn mở cửa hàng tạp hóa', 'HOUSEHOLD_BUSINESS_REGISTRATION'],
    ['thành lập hộ kinh doanh ở Hà Nội', 'HOUSEHOLD_BUSINESS_REGISTRATION'],
    ['đăng ký kinh doanh', 'HOUSEHOLD_BUSINESS_REGISTRATION'],
  ])('maps "%s" to %s', (message, expected) => {
    expect(classifyByKeywords(message)?.procedureCode).toBe(expected);
  });

  it('still maps citizen intents to citizen procedures', () => {
    expect(classifyByKeywords('Tôi muốn đăng ký kết hôn')?.procedureCode).toBe('MARRIAGE_REGISTRATION');
    expect(classifyByKeywords('làm giấy khai sinh cho con')?.procedureCode).toBe('BIRTH_REGISTRATION');
  });

  it.each([
    ['Tôi muốn ly hôn', 'DIVORCE_RESOLUTION'],
    ['tôi muốn li hôn', 'DIVORCE_RESOLUTION'],
    ['xin ly hon đơn phương', 'DIVORCE_RESOLUTION'],
  ])('maps divorce intent "%s" to %s', (message, expected) => {
    expect(classifyByKeywords(message)?.procedureCode).toBe(expected);
  });
});
