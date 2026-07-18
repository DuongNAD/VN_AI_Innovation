import { DISCLAIMER } from '../constants';
import { AppError } from '../errors';
import { evaluateCondition } from '../rule-engine';
import type { DocumentRow, Guidance, GuidanceDocument, QuestionRow, ConditionDef } from './types';
import { assertHttpsSourceUrl, assertConditionDef, parseSteps } from './helpers';

export function buildGuidance(input: {
  procedure: {
    code: string;
    name: string;
    agency: string;
    sourceUrl: string;
    lastCheckedAt: string | Date;
    legalBasisText?: string | null;
  };
  procedureVersion: {
    version: string;
    stepsJson: unknown;
    durationText: string;
    feesText: string;
    legalBasisText?: string | null;
  };
  documents: DocumentRow[];
  answers: Record<string, unknown>;
  questions?: QuestionRow[];
  formAvailable?: boolean;
}): Guidance {
  const { procedure, procedureVersion, documents, answers } = input;

  // Run all guards before assembling any output
  const validatedSourceUrl = assertHttpsSourceUrl(procedure.sourceUrl);
  const validatedSteps = parseSteps(procedureVersion.stepsJson);

  const allowedFields = new Set<string>(
    input.questions
      ? input.questions.map((q) => q.code)
      : Object.keys(answers)
  );

  for (const doc of documents) {
    const cond = doc.condition !== undefined && doc.condition !== null
      ? doc.condition
      : (doc.conditionJson !== undefined && doc.conditionJson !== null ? doc.conditionJson : null);
    if (cond !== null) {
      assertConditionDef(cond, allowedFields, doc.code);
    }
  }

  const checklist: GuidanceDocument[] = [];
  const sortedDocs = [...documents].sort((a, b) => (a.orderNumber ?? 0) - (b.orderNumber ?? 0));

  for (const doc of sortedDocs) {
    const cond = doc.condition !== undefined && doc.condition !== null
      ? doc.condition
      : (doc.conditionJson !== undefined && doc.conditionJson !== null ? doc.conditionJson : null);
    const isConditional = cond !== null;
    const isIncluded = !isConditional || evaluateCondition(cond as ConditionDef, answers);

    if (isIncluded) {
      checklist.push({
        code: doc.code,
        name: doc.name,
        originals: doc.originals,
        copies: doc.copies,
        submissionType: doc.submissionType,
        reason: isConditional ? (doc.reasonText || doc.reason || null) : null,
      });
    }
  }

  const sortedSteps = [...validatedSteps].sort((a, b) => (a.order || 0) - (b.order || 0));

  return {
    procedure: {
      code: procedure.code,
      name: procedure.name,
      agency: procedure.agency,
      sourceUrl: validatedSourceUrl,
      version: procedureVersion.version,
      lastCheckedAt: procedure.lastCheckedAt,
      legalBasisText: procedure.legalBasisText || procedureVersion.legalBasisText || null,
    },
    checklist,
    steps: sortedSteps,
    durationText: procedureVersion.durationText,
    feesText: procedureVersion.feesText,
    disclaimer: DISCLAIMER,
    formAvailable: !!input.formAvailable,
  };
}

