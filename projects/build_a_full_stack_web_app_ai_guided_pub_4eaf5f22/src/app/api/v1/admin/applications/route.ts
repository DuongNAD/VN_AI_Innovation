import { requireStaffAuth } from '@/lib/login-auth';
import { prisma } from '@/lib/db';
import { getProvider, type FormVersionDto } from '@/lib/data-provider';
import { handleRoute, jsonOk } from '@/lib/errors';
import {
  DOCUMENT_TYPE_CODES,
  getDocumentTypeMeta,
  inferDocumentType,
  isDocumentTypeCode,
  type DocumentTypeCode,
} from '@/lib/document-types';

/**
 * Officer queue: citizen applications that were handed over for review,
 * newest first, plus recently reviewed ones for context. Draft applications
 * stay private to the citizen and are never listed here.
 *
 * Query:
 *  - documentType=ALL|MARRIAGE_REGISTRATION|... — filter by classification
 *  - status=SUBMITTED|APPROVED|RETURNED|ALL — optional status filter
 */
export const GET = handleRoute(async (req: Request) => {
  // Managers work the citizen queue too; only form-version changes are admin-only.
  await requireStaffAuth(req, 'manager');

  const url = new URL(req.url);
  const typeFilterRaw = (url.searchParams.get('documentType') || 'ALL').trim().toUpperCase();
  const statusFilterRaw = (url.searchParams.get('status') || 'ALL').trim().toUpperCase();

  const typeFilter: DocumentTypeCode | 'ALL' =
    typeFilterRaw === 'ALL' || typeFilterRaw === ''
      ? 'ALL'
      : isDocumentTypeCode(typeFilterRaw)
        ? typeFilterRaw
        : 'ALL';

  const allowedStatuses = ['SUBMITTED', 'APPROVED', 'RETURNED'] as const;
  const statusFilter =
    statusFilterRaw === 'ALL' || statusFilterRaw === ''
      ? [...allowedStatuses]
      : (allowedStatuses as readonly string[]).includes(statusFilterRaw)
        ? [statusFilterRaw]
        : [...allowedStatuses];

  const rows = await prisma.application.findMany({
    where: {
      status: { in: statusFilter },
      ...(typeFilter === 'ALL' ? {} : { documentType: typeFilter }),
    },
    orderBy: { submittedAt: 'desc' },
    take: 100,
  });

  // One schema lookup per distinct pinned form version (the queue typically
  // holds one or two versions), then reuse it for every application row.
  const provider = getProvider();
  const versionById = new Map<string, FormVersionDto | null>();
  for (const row of rows) {
    if (!versionById.has(row.formVersionId)) {
      versionById.set(row.formVersionId, await provider.getFormVersionById(row.formVersionId));
    }
  }

  const procedureNameByFormCode = new Map<string, string>();
  for (const pinned of versionById.values()) {
    if (pinned && !procedureNameByFormCode.has(pinned.formCode)) {
      // Prefer catalog procedure name; never fail the whole queue if a demo
      // form lacks a full ProcedureVersion (seeded classification forms).
      let name = pinned.formCode;
      try {
        const procedure = await provider.getProcedure(pinned.formCode);
        if (procedure?.name) {
          name = procedure.name;
        }
      } catch {
        const form = await prisma.form.findUnique({
          where: { code: pinned.formCode },
          include: { procedure: true },
        });
        name = form?.name || form?.procedure?.name || pinned.formCode;
      }
      procedureNameByFormCode.set(pinned.formCode, name);
    }
  }

  const applications = rows.flatMap((row) => {
    const pinned = versionById.get(row.formVersionId);
    if (!pinned) {
      return [];
    }
    const documentType =
      row.documentType && isDocumentTypeCode(row.documentType)
        ? row.documentType
        : inferDocumentType(pinned.formCode);
    const meta = getDocumentTypeMeta(documentType);
    return [
      {
        id: row.id,
        status: row.status,
        submittedAt: row.submittedAt,
        reviewedAt: row.reviewedAt,
        reviewedBy: row.reviewedBy,
        reviewNote: row.reviewNote,
        formCode: pinned.formCode,
        formVersion: pinned.version,
        procedureName: procedureNameByFormCode.get(pinned.formCode) ?? pinned.formCode,
        documentType,
        documentTypeLabel: meta.label,
        documentTypeIcon: meta.icon,
        data: row.dataJson,
        fields: pinned.fields,
      },
    ];
  });

  // Stats across the full officer queue (not only the current filter page).
  const grouped = await prisma.application.groupBy({
    by: ['documentType', 'status'],
    where: { status: { in: [...allowedStatuses] } },
    _count: { _all: true },
  });

  const byType: Record<string, { total: number; submitted: number; approved: number; returned: number }> =
    {};
  for (const code of DOCUMENT_TYPE_CODES) {
    byType[code] = { total: 0, submitted: 0, approved: 0, returned: 0 };
  }

  for (const g of grouped) {
    const code =
      g.documentType && isDocumentTypeCode(g.documentType)
        ? g.documentType
        : ('OTHER' as DocumentTypeCode);
    if (!byType[code]) {
      byType[code] = { total: 0, submitted: 0, approved: 0, returned: 0 };
    }
    const n = g._count._all;
    byType[code].total += n;
    if (g.status === 'SUBMITTED') byType[code].submitted += n;
    if (g.status === 'APPROVED') byType[code].approved += n;
    if (g.status === 'RETURNED') byType[code].returned += n;
  }

  const stats = {
    total: Object.values(byType).reduce((s, v) => s + v.total, 0),
    submitted: Object.values(byType).reduce((s, v) => s + v.submitted, 0),
    approved: Object.values(byType).reduce((s, v) => s + v.approved, 0),
    returned: Object.values(byType).reduce((s, v) => s + v.returned, 0),
    byType: DOCUMENT_TYPE_CODES.map((code) => {
      const meta = getDocumentTypeMeta(code);
      const counts = byType[code] ?? { total: 0, submitted: 0, approved: 0, returned: 0 };
      return {
        code,
        label: meta.label,
        icon: meta.icon,
        ...counts,
      };
    }),
  };

  return jsonOk({
    applications,
    stats,
    filters: {
      documentType: typeFilter,
      status: statusFilterRaw === '' ? 'ALL' : statusFilterRaw,
    },
    catalog: DOCUMENT_TYPE_CODES.map((code) => {
      const meta = getDocumentTypeMeta(code);
      return {
        code: meta.code,
        label: meta.label,
        description: meta.description,
        icon: meta.icon,
        badgeClass: meta.badgeClass,
      };
    }),
  });
});
