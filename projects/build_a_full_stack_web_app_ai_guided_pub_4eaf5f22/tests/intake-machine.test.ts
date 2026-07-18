import { describe, it, expect } from 'vitest';
import {
  computeQuestionFlow,
  pruneAnswers,
  validateAnswer,
  buildGuidance,
  QuestionRow,
  DocumentRow
} from '../src/lib/intake-machine';
import { DISCLAIMER } from '../src/lib/constants';
import { AppError } from '../src/lib/errors';

const mockQuestions: QuestionRow[] = [
  {
    code: 'has_foreign_element',
    orderNumber: 1,
    fieldType: 'radio',
    options: [{ value: true, label: 'Có' }, { value: false, label: 'Không' }],
    condition: null,
    questionText: 'Có yếu tố nước ngoài không?'
  },
  {
    code: 'previously_married',
    orderNumber: 2,
    fieldType: 'radio',
    options: [{ value: true, label: 'Có' }, { value: false, label: 'Không' }],
    condition: null,
    questionText: 'Trước đây đã từng kết hôn chưa?'
  },
  {
    code: 'province',
    orderNumber: 3,
    fieldType: 'province',
    options: null,
    condition: null,
    questionText: 'Tỉnh thành đăng ký?'
  },
  {
    code: 'foreign_spouse_nationality',
    orderNumber: 4,
    fieldType: 'text',
    options: null,
    condition: { field: 'has_foreign_element', operator: 'equals', value: true },
    questionText: 'Quốc tịch của vợ/chồng nước ngoài?'
  }
];

const mockDocuments: DocumentRow[] = [
  {
    code: 'CCCD_BOTH',
    name: 'CCCD hai bên',
    originals: 0,
    copies: 2,
    submissionType: 'PRESENT',
    orderNumber: 1,
    condition: null
  },
  {
    code: 'DIVORCE_DOCUMENT',
    name: 'Quyết định ly hôn',
    originals: 1,
    copies: 0,
    submissionType: 'SUBMIT',
    orderNumber: 2,
    condition: { field: 'previously_married', operator: 'equals', value: true },
    reasonText: 'Áp dụng vì bạn đã từng đăng ký kết hôn'
  }
];

describe('Intake Machine - Basic flow, pruning, and validation', () => {
  it('should compute flow in orderNumber sequence and filter based on condition gating', () => {
    const flow1 = computeQuestionFlow(mockQuestions, {});
    expect(flow1.next?.code).toBe('has_foreign_element');
    expect(flow1.answered).toBe(0);
    expect(flow1.total).toBe(3); // foreign_spouse_nationality excluded

    const flow2 = computeQuestionFlow(mockQuestions, { has_foreign_element: true });
    expect(flow2.next?.code).toBe('previously_married');
    expect(flow2.answered).toBe(1);
    expect(flow2.total).toBe(4);

    const flow3 = computeQuestionFlow(mockQuestions, { has_foreign_element: false });
    expect(flow3.next?.code).toBe('previously_married');
    expect(flow3.answered).toBe(1);
    expect(flow3.total).toBe(3);
  });

  it('should support preset answers and adjust total/next accordingly', () => {
    const flow = computeQuestionFlow(mockQuestions, { province: 'Hà Nội' });
    expect(flow.next?.code).toBe('has_foreign_element');
    expect(flow.answered).toBe(1);
    expect(flow.total).toBe(3);
  });

  it('should pruneAnswers: drop unknown keys, and prune dependent chains to a fixpoint', () => {
    const answers = {
      has_foreign_element: true,
      foreign_spouse_nationality: 'Canada',
      bogus_key: 123
    };
    const pruned1 = pruneAnswers(mockQuestions, answers);
    expect(pruned1.answers).toEqual({
      has_foreign_element: true,
      foreign_spouse_nationality: 'Canada'
    });
    expect(pruned1.removed).toContain('bogus_key');

    const answers2 = {
      has_foreign_element: false,
      foreign_spouse_nationality: 'Canada'
    };
    const pruned2 = pruneAnswers(mockQuestions, answers2);
    expect(pruned2.answers).toEqual({
      has_foreign_element: false
    });
    expect(pruned2.removed).toEqual(['foreign_spouse_nationality']);
  });

  it('should validateAnswer correctly: coercing boolean radio/select, validating limits/provinces', () => {
    const expectInvalidAnswer = (run: () => unknown) => {
      let thrown: unknown;
      try {
        run();
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBeInstanceOf(AppError);
      expect(thrown).toMatchObject({
        status: 400,
        code: 'INVALID_ANSWER',
        message: 'Câu trả lời không hợp lệ.',
      });
    };

    expect(validateAnswer(mockQuestions[0], 'true')).toBe(true);
    expect(validateAnswer(mockQuestions[0], 'false')).toBe(false);
    expect(validateAnswer(mockQuestions[0], true)).toBe(true);

    expectInvalidAnswer(() => validateAnswer(mockQuestions[0], 'maybe'));

    expect(validateAnswer(mockQuestions[2], 'Hà Nội')).toBe('Hà Nội');
    expectInvalidAnswer(() => validateAnswer(mockQuestions[2], 'Nowhere'));

    expect(validateAnswer(mockQuestions[3], '  Canada  ')).toBe('Canada');
    expectInvalidAnswer(() => validateAnswer(mockQuestions[3], ''));
    expectInvalidAnswer(() => validateAnswer(mockQuestions[3], 'a'.repeat(501)));
  });
});

describe('Intake Machine - buildGuidance and validation guards', () => {
  const validProcedure = {
    code: 'MARRIAGE',
    name: 'Đăng ký kết hôn',
    agency: 'UBND cấp xã',
    sourceUrl: 'https://dichvucong.gov.vn/test',
    lastCheckedAt: '2026-01-01T00:00:00Z',
    legalBasisText: 'Luật Hộ tịch'
  };

  const validVersion = {
    version: '1.0',
    stepsJson: JSON.stringify([
      { order: 1, title: 'Bước 1', description: 'Chuẩn bị hồ sơ', example: 'Ví dụ: Mang theo CCCD' }
    ]),
    durationText: '1 ngày',
    feesText: 'Miễn phí'
  };

  it('should build guidance with correct checklist, steps, and strict disclaimer equality', () => {
    const guidance = buildGuidance({
      procedure: validProcedure,
      procedureVersion: validVersion,
      documents: mockDocuments,
      answers: { previously_married: true },
      questions: mockQuestions
    });

    expect(guidance.procedure.sourceUrl).toBe(validProcedure.sourceUrl);
    expect(guidance.disclaimer).toBe(DISCLAIMER);
    expect(guidance.checklist.length).toBe(2);
    expect(guidance.checklist[1].code).toBe('DIVORCE_DOCUMENT');
    expect(guidance.checklist[1].reason).toBe('Áp dụng vì bạn đã từng đăng ký kết hôn');
  });

  it('should exclude conditional documents when condition evaluates to false', () => {
    const guidance = buildGuidance({
      procedure: validProcedure,
      procedureVersion: validVersion,
      documents: mockDocuments,
      answers: { previously_married: false },
      questions: mockQuestions
    });
    expect(guidance.checklist.length).toBe(1);
    expect(guidance.checklist[0].code).toBe('CCCD_BOTH');
  });

  it('should enforce sourceUrl guard rules', () => {
    const runWithUrl = (url: unknown) => {
      buildGuidance({
        procedure: { ...validProcedure, sourceUrl: url as string },
        procedureVersion: validVersion,
        documents: mockDocuments,
        answers: { previously_married: false }
      });
    };

    expect(() => runWithUrl('javascript:alert(1)')).toThrow();
    expect(() => runWithUrl('data:text/html,abc')).toThrow();
    expect(() => runWithUrl('http://dichvucong.gov.vn')).toThrow();
    expect(() => runWithUrl('https://user:password@dichvucong.gov.vn')).toThrow();
    expect(() => runWithUrl(123)).toThrow();
    expect(() => runWithUrl('https://' + 'a'.repeat(2048))).toThrow();
    expect(() => runWithUrl('https://dichvucong.gov.vn/home')).not.toThrow();
  });

  it('should enforce Document condition guard rules', () => {
    const runWithDocCondition = (cond: any) => {
      buildGuidance({
        procedure: validProcedure,
        procedureVersion: validVersion,
        documents: [
          {
            ...mockDocuments[0],
            condition: cond
          }
        ],
        answers: { previously_married: false },
        questions: mockQuestions
      });
    };

    expect(() => runWithDocCondition({ field: 'previously_married', operator: 'invalid_op', value: true })).toThrow();
    expect(() => runWithDocCondition({ field: 'previously_married', operator: 'equals', value: true, extra: 1 })).toThrow();
    expect(() => runWithDocCondition({ field: 'missing_question_code', operator: 'equals', value: true })).toThrow();
    expect(() => runWithDocCondition({ field: 'previously_married', operator: 'equals', value: { nested: true } })).toThrow();
  });

  it('should enforce Question condition guard rules on computeQuestionFlow and pruneAnswers', () => {
    const badQuestions: QuestionRow[] = [
      {
        ...mockQuestions[0],
        condition: { field: 'previously_married', operator: 'bad_operator' as any, value: true }
      }
    ];

    expect(() => computeQuestionFlow(badQuestions, {})).toThrow();
    expect(() => pruneAnswers(badQuestions, {})).toThrow();
  });

  it('should enforce stepsJson guard rules', () => {
    const runWithSteps = (steps: unknown) => {
      buildGuidance({
        procedure: validProcedure,
        procedureVersion: { ...validVersion, stepsJson: steps },
        documents: mockDocuments,
        answers: { previously_married: false }
      });
    };

    expect(() => runWithSteps('{invalid-json}')).toThrow();
    expect(() => runWithSteps(' '.repeat(100001))).toThrow();
    expect(() => runWithSteps(JSON.stringify({ step1: 'prepare' }))).toThrow();
    expect(() => runWithSteps(JSON.stringify([{ order: 1 }]))).toThrow();
    expect(() =>
      runWithSteps(
        JSON.stringify([
          { order: 1, title: 'a'.repeat(2001), description: 'Desc', example: 'Ex' }
        ])
      )
    ).toThrow();

    expect(() => runWithSteps('[]')).not.toThrow();
  });

  it('should fallback to keys of answers when questions are not provided in buildGuidance', () => {
    expect(() =>
      buildGuidance({
        procedure: validProcedure,
        procedureVersion: validVersion,
        documents: mockDocuments,
        answers: { previously_married: true }
      })
    ).not.toThrow();

    expect(() =>
      buildGuidance({
        procedure: validProcedure,
        procedureVersion: validVersion,
        documents: mockDocuments,
        answers: {}
      })
    ).toThrow();
  });
});
