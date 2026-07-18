import type { FieldDef, RuleDef, MigrationHint, ConditionDef } from '../schema-guards';
import type { QuestionRow } from '../intake-machine';

export interface ProcedureDto {
  code: string;
  name: string;
  sector: string;
  agency: string;
  sourceUrl: string;
  version: string;
  lastCheckedAt: Date;
}

export interface ProcedureVersionDto {
  id: string;
  procedureId: string;
  version: string;
  status: string;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  stepsJson: any;
  durationText: string;
  feesText: string;
  legalBasisText: string | null;
}

export interface DocumentRow {
  code: string;
  name: string;
  originals: number;
  copies: number;
  submissionType: 'SUBMIT' | 'PRESENT' | 'SYSTEM_LOOKUP';
  condition: ConditionDef | null;
  reasonText: string | null;
  orderNumber: number;
}

export interface FormDto {
  id: string;
  code: string;
  procedureId: string;
  name: string;
  revision: number;
}

export interface FormVersionDto {
  id: string;
  formId: string;
  formCode: string;
  version: string;
  status: string;
  effectiveFrom: Date | null;
  effectiveTo: Date | null;
  fields: FieldDef[];
  migrationHints: MigrationHint[];
}

export interface CatalogOverviewItem {
  code: string;
  name: string;
  agency: string;
  sourceUrl: string;
  lastCheckedAt: Date;
  activeVersion: {
    version: string;
    effectiveFrom: Date | null;
    effectiveTo: Date | null;
  } | null;
  formVersions: {
    version: string;
    status: 'DRAFT' | 'ACTIVE' | 'RETIRED';
    effectiveFrom: Date | null;
    effectiveTo: Date | null;
  }[];
}

export type CatalogOverviewDto = CatalogOverviewItem[];

export interface IProcedureDataProvider {
  getProcedure(code: string): Promise<ProcedureDto | null>;
  listProcedures(): Promise<ProcedureDto[]>;
  getActiveProcedureVersion(procedureId: string): Promise<ProcedureVersionDto | null>;
  getClarifyingQuestions(procedureId: string): Promise<QuestionRow[]>;
  getDocuments(procedureId: string): Promise<DocumentRow[]>;
  getForm(code: string): Promise<FormDto | null>;
  getFormVersion(formCode: string, version: string): Promise<FormVersionDto | null>;
  getActiveFormVersion(formCode: string, at?: Date): Promise<FormVersionDto | null>;
  getValidationRules(formVersionId: string): Promise<RuleDef[]>;
  getCatalogOverview(): Promise<CatalogOverviewDto>;
  getFormVersionById(id: string): Promise<FormVersionDto | null>;
}
