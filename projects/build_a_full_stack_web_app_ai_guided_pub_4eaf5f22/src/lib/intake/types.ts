export type ConditionDef = {
  field: string;
  operator: 'equals' | 'not_equals' | 'in' | 'greater_than' | 'less_than' | 'is_empty' | 'not_empty';
  value?: unknown;
};

export type QuestionRow = {
  code: string;
  orderNumber: number;
  fieldType: 'radio' | 'select' | 'text' | 'province';
  options: { value: string | boolean; label: string }[] | null;
  condition: ConditionDef | null;
  questionText: string;
};

export type DocumentRow = {
  code: string;
  name: string;
  originals: number;
  copies: number;
  submissionType: 'SUBMIT' | 'PRESENT' | 'SYSTEM_LOOKUP';
  orderNumber: number;
  condition?: unknown | null;
  conditionJson?: unknown | null;
  reasonText?: string | null;
  reason?: string | null;
};

export type GuidanceDocument = {
  code: string;
  name: string;
  originals: number;
  copies: number;
  submissionType: 'SUBMIT' | 'PRESENT' | 'SYSTEM_LOOKUP';
  reason: string | null;
};

export type Guidance = {
  procedure: {
    code: string;
    name: string;
    agency: string;
    sourceUrl: string;
    version: string;
    lastCheckedAt: string | Date;
    legalBasisText: string | null;
  };
  checklist: GuidanceDocument[];
  steps: any[];
  durationText: string;
  feesText: string;
  disclaimer: string;
  formAvailable: boolean;
};
