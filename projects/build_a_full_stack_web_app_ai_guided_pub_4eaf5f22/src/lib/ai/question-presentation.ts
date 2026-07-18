import type { QuestionRow } from '@/lib/intake-machine';
import {
  getLlmProvider,
  mockLlm,
  type QuestionRewrite,
  type QuestionRewriteInput,
} from '@/lib/ai/llm';

type ProcedureSummary = {
  code: string;
  name: string;
};

export type PresentedQuestion = QuestionRow & {
  originalQuestionText: string;
  helpText: string;
  examples: string[];
};

export type QuestionPresentationResult = {
  question: PresentedQuestion;
  aiMode: string;
  degraded: boolean;
};

const cache = new Map<string, QuestionRewrite>();
const CACHE_LIMIT = 256;

function cacheSet(key: string, value: QuestionRewrite): void {
  if (cache.size >= CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (typeof oldest === 'string') {
      cache.delete(oldest);
    }
  }
  cache.set(key, value);
}

export async function presentQuestion(
  question: QuestionRow,
  procedure: ProcedureSummary
): Promise<QuestionPresentationResult> {
  const input: QuestionRewriteInput = {
    procedureCode: procedure.code,
    procedureName: procedure.name,
    questionCode: question.code,
    questionText: question.questionText,
    fieldType: question.fieldType,
    optionLabels: (question.options ?? []).map((option) => option.label),
  };
  const provider = getLlmProvider();
  const key = JSON.stringify([provider.name, input]);
  let rewrite = cache.get(key);
  let degraded = false;
  let aiMode = provider.name;

  if (!rewrite) {
    try {
      rewrite = await provider.rewriteQuestion(input);
    } catch {
      rewrite = await mockLlm.rewriteQuestion(input);
      degraded = true;
      aiMode = 'mock';
    }
    cacheSet(key, rewrite);
  }

  return {
    question: {
      ...question,
      originalQuestionText: question.questionText,
      questionText: rewrite.questionText,
      helpText: rewrite.helpText,
      examples: rewrite.examples,
    },
    aiMode,
    degraded,
  };
}
