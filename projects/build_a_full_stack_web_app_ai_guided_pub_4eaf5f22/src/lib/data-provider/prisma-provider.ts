import { prisma } from '../db';
import { AppError } from '../errors';
import {
  FieldDef,
  RuleDef,
  parseFieldDefs,
  parseRuleDefs,
  safeHttpsUrl,
} from '../schema-guards';
import { selectActiveVersion } from '../form-migration';
import type { QuestionRow } from '../intake-machine';
import type {
  ProcedureDto,
  ProcedureVersionDto,
  DocumentRow,
  FormDto,
  FormVersionDto,
  CatalogOverviewDto,
  CatalogOverviewItem,
  IProcedureDataProvider,
} from './types';
import {
  parseConditionDef,
  parseQuestionOptions,
  parseSteps,
  mapFormVersion,
} from './helpers';

export class PrismaProcedureDataProvider implements IProcedureDataProvider {
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

