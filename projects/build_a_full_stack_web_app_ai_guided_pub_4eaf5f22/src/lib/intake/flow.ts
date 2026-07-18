import { evaluateCondition } from '../rule-engine';
import type { QuestionRow } from './types';
import { assertConditionDef } from './helpers';

export function computeQuestionFlow(
  questions: QuestionRow[],
  answers: Record<string, unknown>
): { next: QuestionRow | null; answered: number; total: number } {
  const allowedFields = new Set(questions.map((q) => q.code));
  for (const q of questions) {
    if (q.condition !== null && q.condition !== undefined) {
      assertConditionDef(q.condition, allowedFields, q.code);
    }
  }

  const sorted = [...questions].sort((a, b) => a.orderNumber - b.orderNumber);
  let total = 0;
  let answered = 0;
  let next: QuestionRow | null = null;

  for (const q of sorted) {
    const isApplicable = !q.condition || evaluateCondition(q.condition, answers);
    if (isApplicable) {
      total++;
      if (answers[q.code] !== undefined) {
        answered++;
      } else if (!next) {
        next = q;
      }
    }
  }

  return { next, answered, total };
}

export function pruneAnswers(
  questions: QuestionRow[],
  answers: Record<string, unknown>
): { answers: Record<string, unknown>; removed: string[] } {
  const allowedFields = new Set(questions.map((q) => q.code));
  for (const q of questions) {
    if (q.condition !== null && q.condition !== undefined) {
      assertConditionDef(q.condition, allowedFields, q.code);
    }
  }

  const currentAnswers = { ...answers };
  const questionCodes = new Set(questions.map((q) => q.code));
  const removedSet = new Set<string>();

  // Drop keys with no matching question
  for (const key of Object.keys(currentAnswers)) {
    if (!questionCodes.has(key)) {
      delete currentAnswers[key];
      removedSet.add(key);
    }
  }

  // Iterate to FIXPOINT
  let changed = true;
  while (changed) {
    changed = false;
    for (const q of questions) {
      if (currentAnswers[q.code] !== undefined) {
        const isApplicable = !q.condition || evaluateCondition(q.condition, currentAnswers);
        if (!isApplicable) {
          delete currentAnswers[q.code];
          removedSet.add(q.code);
          changed = true;
        }
      }
    }
  }

  return {
    answers: currentAnswers,
    removed: Array.from(removedSet),
  };
}

