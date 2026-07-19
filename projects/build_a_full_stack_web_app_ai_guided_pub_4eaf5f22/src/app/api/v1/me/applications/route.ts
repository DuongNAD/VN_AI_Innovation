import { prisma } from '@/lib/db';
import { getProvider, type FormVersionDto } from '@/lib/data-provider';
import { handleRoute, jsonOk } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { requireAuthUser } from '@/lib/login-auth';
import { SIGNED_DECLARATION_FIELD_ID } from '@/lib/application-attachments';

/**
 * The logged-in citizen's own applications ("Hồ sơ của tôi"), newest first.
 * Authorized by the login cookie and filtered to Application.userId — never
 * exposes anyone else's applications. Metadata only (no form data or bytes).
 */
export const GET = handleRoute(async (req: Request) => {
  enforceRateLimit('applications', req);
  const user = await requireAuthUser(req, ['user']);

  const rows = await prisma.application.findMany({
    where: { userId: user.id },
    orderBy: [{ updatedAt: 'desc' }],
    take: 50,
    select: {
      id: true,
      status: true,
      formVersionId: true,
      submittedAt: true,
      reviewedAt: true,
      reviewNote: true,
      createdAt: true,
      updatedAt: true,
    },
  });

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

  const signedIds = new Set<string>();
  if (rows.length > 0) {
    const signed = await prisma.applicationAttachment.findMany({
      where: {
        applicationId: { in: rows.map((row) => row.id) },
        fieldId: SIGNED_DECLARATION_FIELD_ID,
      },
      select: { applicationId: true },
    });
    for (const row of signed) {
      signedIds.add(row.applicationId);
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
      formCode: pinned.formCode,
      formVersion: pinned.version,
      procedureName: procedureNameByFormCode.get(pinned.formCode) ?? pinned.formCode,
      submittedAt: row.submittedAt,
      reviewedAt: row.reviewedAt,
      reviewNote: row.reviewNote,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      hasSignedDeclaration: signedIds.has(row.id),
    }];
  });

  return jsonOk({ applications });
});
