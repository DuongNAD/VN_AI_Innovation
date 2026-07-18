import { describe, expect, it } from 'vitest';
import {
  mockLlm,
  normalizeGeneratedVietnameseText,
  openaiLlm,
} from '@/lib/ai/llm';

describe('AI question presentation', () => {
  it('rewrites the foreign-element marriage question in plain Vietnamese', async () => {
    const result = await mockLlm.rewriteQuestion({
      procedureCode: 'MARRIAGE_REGISTRATION',
      procedureName: 'Đăng ký kết hôn',
      questionCode: 'has_foreign_element',
      questionText: 'Đăng ký kết hôn có yếu tố nước ngoài không?',
      fieldType: 'radio',
      optionLabels: ['Có', 'Không'],
    });

    expect(result.questionText).toContain('người nước ngoài');
    expect(result.helpText).toContain('Chọn');
    expect(result.examples.length).toBeGreaterThan(0);
  });

  it('keeps an official unknown question and adds a safe generic explanation', async () => {
    const result = await mockLlm.rewriteQuestion({
      procedureCode: 'BIRTH_REGISTRATION',
      procedureName: 'Đăng ký khai sinh',
      questionCode: 'birth_location',
      questionText: 'Trẻ được sinh ra ở đâu?',
      fieldType: 'select',
      optionLabels: ['Cơ sở y tế', 'Tại nhà', 'Nơi khác'],
    });

    expect(result.questionText).toBe('Trẻ được sinh ra ở đâu?');
    expect(result.helpText).toContain('tình huống thực tế');
  });

  it('uses a clear, curated explanation for previous marriages', async () => {
    const input = {
      procedureCode: 'MARRIAGE_REGISTRATION',
      procedureName: 'Đăng ký kết hôn',
      questionCode: 'previously_married',
      questionText: 'Bạn đã từng đăng ký kết hôn lần nào trước đây chưa?',
      fieldType: 'radio' as const,
      optionLabels: ['Có', 'Không'],
    };

    const result = await openaiLlm.rewriteQuestion(input);

    expect(result.questionText).toBe('Trước đây bạn đã từng đăng ký kết hôn chưa?');
    expect(result.helpText).toContain('vợ/chồng trước của bạn đã mất');
    expect(result.examples).toHaveLength(3);
    expect(JSON.stringify(result)).not.toMatch(/g[oó]a\s+bụa/iu);
  });

  it('filters unclear old wording from generated Vietnamese text', () => {
    expect(
      normalizeGeneratedVietnameseText(
        'Nếu bạn đã ly hôn hoặc góa bụa, hãy chọn “Có”.'
      )
    ).toBe(
      'Nếu bạn đã ly hôn hoặc có vợ hoặc chồng đã mất, hãy chọn “Có”.'
    );
    expect(
      normalizeGeneratedVietnameseText('Nếu bạn goá bụa, hãy chọn “Có”.')
    ).toBe('Nếu bạn có vợ hoặc chồng đã mất, hãy chọn “Có”.');
  });
});
