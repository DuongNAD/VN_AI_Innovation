import { describe, expect, it } from 'vitest';
import { mockLlm } from '@/lib/ai/llm';

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
});
