import { buildGuidance } from '@/lib/intake-machine';

type BuildGuidanceInput = Parameters<typeof buildGuidance>[0];

/**
 * Assembles the full guidance payload the citizen-facing endpoints return:
 * base guidance + per-document submission types + normalized steps + the
 * form-availability flag. Extracted so the guidance route and the TTS
 * pre-generation CLI build the exact same object (and therefore the exact same
 * spoken summary and cache key) from one implementation.
 */
export function assembleGuidance(
  input: BuildGuidanceInput & { formAvailable?: boolean }
): Record<string, any> {
  const { formAvailable = false } = input;
  const baseGuidance = buildGuidance(input);

  const documents = input.documents;
  const procVersion = input.procedureVersion as any;

  const docMap = new Map(documents.map((d) => [d.code, d]));
  const checklist = baseGuidance.checklist.map((item: any) => {
    const doc = docMap.get(item.code);
    return {
      ...item,
      submissionType: doc ? doc.submissionType : 'SUBMIT',
    };
  });

  const rawSteps: any = (baseGuidance as any).steps || procVersion.stepsJson || [];
  const steps = rawSteps.map((step: any) => ({
    order: step.order,
    title: step.title,
    description: step.description,
    example: step.example || '',
  }));

  return {
    ...baseGuidance,
    legalBasisText: procVersion.legalBasisText || null,
    procedure: {
      ...baseGuidance.procedure,
      legalBasisText: procVersion.legalBasisText || null,
    },
    checklist,
    steps,
    formAvailable,
  };
}
