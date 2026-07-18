import { requireStaffAuth } from '@/lib/login-auth';
import { prisma } from '@/lib/db';
import { getProvider, type FormVersionDto } from '@/lib/data-provider';
import { handleRoute, jsonOk } from '@/lib/errors';

/**
 * Officer queue: citizen applications that were handed over for review,
 * newest first, plus recently reviewed ones for context. Draft applications
 * stay private to the citizen and are never listed here.
 */
export const GET = handleRoute(async (req: Request) => {
  // Managers work the citizen queue too; only form-version changes are admin-only.
  await requireStaffAuth(req, 'manager');

  const rows = await prisma.application.findMany({
    where: { status: { in: ['SUBMITTED', 'APPROVED', 'RETURNED'] } },
    orderBy: { submittedAt: 'desc' },
    take: 50,
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
      const procedure = await provider.getProcedure(pinned.formCode);
      procedureNameByFormCode.set(pinned.formCode, procedure?.name ?? pinned.formCode);
    }
  }

  const applications = rows.flatMap((row) => {
    const pinned = versionById.get(row.formVersionId);
    if (!pinned) {
      return [];
    }
    return [{
      id: row.id,
      status: row.status,
      submittedAt: row.submittedAt,
      reviewedAt: row.reviewedAt,
      reviewedBy: row.reviewedBy,
      reviewNote: row.reviewNote,
      formCode: pinned.formCode,
      formVersion: pinned.version,
      procedureName: procedureNameByFormCode.get(pinned.formCode) ?? pinned.formCode,
      data: row.dataJson,
      fields: pinned.fields,
    }];
  });

  return jsonOk({ applications });
});
