import { prisma } from './db';
import { AppError } from './errors';
import {
  FieldDef,
  RuleDef,
  MigrationHint,
  ConditionDef,
  parseFieldDefs,
  parseMigrationHints,
  parseRuleDefs,
  safeHttpsUrl
} from './schema-guards';
import { selectActiveVersion } from './form-migration';
import { QuestionRow } from './intake-machine';

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

// Helpers for condition, question options, and steps parsing with strict validation

function parseConditionDef(raw: any): ConditionDef | null {
  if (!raw) return null;
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
      reason: 'Condition must be an object'
    });
  }
  const { field, operator, value } = raw;
  if (typeof field !== 'string' || !field) {
    throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
      reason: 'Condition field must be a non-empty string'
    });
  }
  const validOperators = ['equals', 'not_equals', 'in', 'greater_than', 'less_than', 'is_empty', 'not_empty'];
  if (!validOperators.includes(operator)) {
    throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
      reason: `Invalid condition operator: ${operator}`
    });
  }
  return { field, operator, value };
}

function parseQuestionOptions(raw: any): { value: string | boolean; label: string }[] | null {
  if (raw === null || raw === undefined) return null;
  if (!Array.isArray(raw)) {
    throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
      reason: 'Options must be an array'
    });
  }
  return raw.map((opt: any, idx: number) => {
    if (typeof opt !== 'object' || opt === null) {
      throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
        reason: `Option at index ${idx} must be an object`
      });
    }
    const { value, label } = opt;
    if (typeof value !== 'string' && typeof value !== 'boolean') {
      throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
        reason: `Option value at index ${idx} must be a string or boolean`
      });
    }
    if (typeof label !== 'string' || !label) {
      throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
        reason: `Option label at index ${idx} must be a non-empty string`
      });
    }
    return { value, label };
  });
}

function parseSteps(raw: any): { order: number; title: string; description: string; example: string }[] {
  if (!Array.isArray(raw)) {
    throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
      reason: 'Steps must be an array'
    });
  }
  return raw.map((step: any, idx: number) => {
    if (typeof step !== 'object' || step === null) {
      throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
        reason: `Step at index ${idx} must be an object`
      });
    }
    const { order, title, description, example } = step;
    if (typeof order !== 'number') {
      throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
        reason: `Step order at index ${idx} must be a number`
      });
    }
    if (typeof title !== 'string' || !title) {
      throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
        reason: `Step title at index ${idx} must be a non-empty string`
      });
    }
    if (typeof description !== 'string' || !description) {
      throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
        reason: `Step description at index ${idx} must be a non-empty string`
      });
    }
    if (typeof example !== 'string' || !example) {
      throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
        reason: `Step example at index ${idx} must be a non-empty string`
      });
    }
    return { order, title, description, example };
  });
}

function mapFormVersion(row: any): FormVersionDto {
  const schemaObj = (row.schemaJson && typeof row.schemaJson === 'object') ? (row.schemaJson as any) : {};
  return {
    id: row.id,
    formId: row.formId,
    formCode: row.form?.code ?? '',
    version: row.version,
    status: row.status,
    effectiveFrom: row.effectiveFrom ? new Date(row.effectiveFrom) : null,
    effectiveTo: row.effectiveTo ? new Date(row.effectiveTo) : null,
    fields: parseFieldDefs(schemaObj.fields),
    migrationHints: parseMigrationHints(schemaObj.migrationHints ?? []),
  };
}

class PrismaProcedureDataProvider implements IProcedureDataProvider {
  async getProcedure(code: string): Promise<ProcedureDto | null> {
    const row = await prisma.procedure.findUnique({
      where: { code },
      include: {
        versions: true,
      },
    });
    if (!row) return null;

    const validatedUrl = safeHttpsUrl(row.sourceUrl);
    if (!validatedUrl) {
      throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
        reason: `Invalid sourceUrl for procedure: ${row.code}`
      });
    }

    const activeVer = selectActiveVersion(row.versions, new Date());
    if (!activeVer) {
      throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
        reason: `No active version for procedure: ${row.code}`
      });
    }

    return {
      code: row.code,
      name: row.name,
      sector: row.sector,
      agency: row.agency,
      sourceUrl: validatedUrl,
      version: activeVer.version,
      lastCheckedAt: row.lastCheckedAt,
    };
  }

  async listProcedures(): Promise<ProcedureDto[]> {
    const rows = await prisma.procedure.findMany({
      include: {
        versions: true,
      },
    });

    const dtos: ProcedureDto[] = [];
    for (const row of rows) {
      const validatedUrl = safeHttpsUrl(row.sourceUrl);
      if (!validatedUrl) {
        throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
          reason: `Invalid sourceUrl for procedure: ${row.code}`
        });
      }
      const activeVer = selectActiveVersion(row.versions, new Date());
      if (!activeVer) {
        throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
          reason: `No active version for procedure: ${row.code}`
        });
      }
      dtos.push({
        code: row.code,
        name: row.name,
        sector: row.sector,
        agency: row.agency,
        sourceUrl: validatedUrl,
        version: activeVer.version,
        lastCheckedAt: row.lastCheckedAt,
      });
    }
    return dtos;
  }

  async getActiveProcedureVersion(procedureId: string): Promise<ProcedureVersionDto | null> {
    const rows = await prisma.procedureVersion.findMany({
      where: { procedureId },
    });
    const activeRow = selectActiveVersion(rows, new Date());
    if (!activeRow) return null;

    const steps = parseSteps(activeRow.stepsJson);

    return {
      id: activeRow.id,
      procedureId: activeRow.procedureId,
      version: activeRow.version,
      status: activeRow.status,
      effectiveFrom: activeRow.effectiveFrom ? new Date(activeRow.effectiveFrom) : null,
      effectiveTo: activeRow.effectiveTo ? new Date(activeRow.effectiveTo) : null,
      stepsJson: steps,
      durationText: activeRow.durationText,
      feesText: activeRow.feesText,
      legalBasisText: activeRow.legalBasisText,
    };
  }

  async getClarifyingQuestions(procedureId: string): Promise<QuestionRow[]> {
    const rows = await prisma.clarifyingQuestion.findMany({
      where: { procedureId },
      orderBy: { orderNumber: 'asc' },
    });

    return rows.map(row => {
      const validFieldTypes = ['radio', 'select', 'text', 'province'];
      if (!validFieldTypes.includes(row.fieldType)) {
        throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
          reason: `Invalid fieldType for question ${row.code}: ${row.fieldType}`
        });
      }

      const options = parseQuestionOptions(row.optionsJson);
      const condition = parseConditionDef(row.conditionJson);

      return {
        code: row.code,
        orderNumber: row.orderNumber,
        fieldType: row.fieldType as 'radio' | 'select' | 'text' | 'province',
        options,
        condition,
        questionText: row.questionText,
      };
    });
  }

  async getDocuments(procedureId: string): Promise<DocumentRow[]> {
    const rows = await prisma.documentRequirement.findMany({
      where: { procedureId },
      orderBy: { orderNumber: 'asc' },
    });

    return rows.map(row => {
      const validSubmissionTypes = ['SUBMIT', 'PRESENT', 'SYSTEM_LOOKUP'];
      if (!validSubmissionTypes.includes(row.submissionType)) {
        throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
          reason: `Invalid submissionType for document ${row.code}: ${row.submissionType}`
        });
      }

      const condition = parseConditionDef(row.conditionJson);

      return {
        code: row.code,
        name: row.name,
        originals: row.originals,
        copies: row.copies,
        submissionType: row.submissionType as 'SUBMIT' | 'PRESENT' | 'SYSTEM_LOOKUP',
        condition,
        reasonText: row.reasonText,
        orderNumber: row.orderNumber,
      };
    });
  }

  async getForm(code: string): Promise<FormDto | null> {
    const row = await prisma.form.findUnique({
      where: { code },
    });
    if (!row) return null;
    return {
      id: row.id,
      code: row.code,
      procedureId: row.procedureId,
      name: row.name,
      revision: row.revision,
    };
  }

  async getFormVersion(formCode: string, version: string): Promise<FormVersionDto | null> {
    const row = await prisma.formVersion.findFirst({
      where: {
        version,
        form: {
          code: formCode,
        },
      },
      include: {
        form: true,
      },
    });
    if (!row) return null;
    return mapFormVersion(row);
  }

  async getActiveFormVersion(formCode: string, at?: Date): Promise<FormVersionDto | null> {
    const formVersions = await prisma.formVersion.findMany({
      where: {
        form: {
          code: formCode,
        },
      },
      include: {
        form: true,
      },
    });
    const mapped = formVersions.map(fv => mapFormVersion(fv));
    return selectActiveVersion(mapped, at ?? new Date());
  }

  async getValidationRules(formVersionId: string): Promise<RuleDef[]> {
    const fv = await prisma.formVersion.findUnique({
      where: { id: formVersionId },
    });
    if (!fv) {
      throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
        reason: `Form version not found: ${formVersionId}`
      });
    }

    const schemaObj = (fv.schemaJson && typeof fv.schemaJson === 'object') ? (fv.schemaJson as any) : {};
    const fields = parseFieldDefs(schemaObj.fields);

    const rulesRows = await prisma.validationRule.findMany({
      where: { formVersionId },
      orderBy: { orderNumber: 'asc' },
    });

    const rawRules = rulesRows.map(r => ({
      id: r.id,
      type: r.type,
      fieldId: r.fieldId ?? undefined,
      params: (r.paramsJson && typeof r.paramsJson === 'object') ? (r.paramsJson as Record<string, any>) : {},
      message: r.message,
      suggestion: r.suggestion,
      severity: r.severity as 'error' | 'warning',
      orderNumber: r.orderNumber,
    }));

    return parseRuleDefs(rawRules, fields);
  }

  async getCatalogOverview(): Promise<CatalogOverviewDto> {
    const procedures = await prisma.procedure.findMany({
      include: {
        versions: true,
      },
    });

    const forms = await prisma.form.findMany({
      include: {
        versions: true,
      },
    });

    const overview: CatalogOverviewItem[] = [];

    for (const proc of procedures) {
      const validatedUrl = safeHttpsUrl(proc.sourceUrl);
      if (!validatedUrl) {
        throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
          reason: `Invalid sourceUrl for procedure: ${proc.code}`
        });
      }

      const activeProcVer = selectActiveVersion(proc.versions, new Date());
      const activeVersionDto = activeProcVer ? {
        version: activeProcVer.version,
        effectiveFrom: activeProcVer.effectiveFrom ? new Date(activeProcVer.effectiveFrom) : null,
        effectiveTo: activeProcVer.effectiveTo ? new Date(activeProcVer.effectiveTo) : null,
      } : null;

      const relatedForm = forms.find(f => f.procedureId === proc.id);
      const formVersions = relatedForm ? relatedForm.versions : [];

      const formVersionsDto = formVersions.map(fv => {
        if (fv.status !== 'DRAFT' && fv.status !== 'ACTIVE' && fv.status !== 'RETIRED') {
          throw new AppError(500, 'DATA_INTEGRITY', 'Dữ liệu cấu hình không hợp lệ.', {
            reason: `Invalid form version status: ${fv.status}`
          });
        }
        return {
          version: fv.version,
          status: fv.status as 'DRAFT' | 'ACTIVE' | 'RETIRED',
          effectiveFrom: fv.effectiveFrom ? new Date(fv.effectiveFrom) : null,
          effectiveTo: fv.effectiveTo ? new Date(fv.effectiveTo) : null,
        };
      });

      overview.push({
        code: proc.code,
        name: proc.name,
        agency: proc.agency,
        sourceUrl: validatedUrl,
        lastCheckedAt: proc.lastCheckedAt,
        activeVersion: activeVersionDto,
        formVersions: formVersionsDto,
      });
    }

    return overview;
  }

  async getFormVersionById(id: string): Promise<FormVersionDto | null> {
    const row = await prisma.formVersion.findUnique({
      where: { id },
      include: {
        form: true,
      },
    });
    if (!row) return null;
    return mapFormVersion(row);
  }
}

const providerInstance = new PrismaProcedureDataProvider();

export function getProvider(): IProcedureDataProvider {
  return providerInstance;
}