/**
 * Intake state machine — re-exports split modules (behavior unchanged).
 */
export type {
  ConditionDef,
  QuestionRow,
  DocumentRow,
  GuidanceDocument,
  Guidance,
} from './intake/types';
export { computeQuestionFlow, pruneAnswers } from './intake/flow';
export { validateAnswer } from './intake/validate-answer';
export { buildGuidance } from './intake/guidance';
