import { handleRoute, jsonOk } from '@/lib/errors';
import { requireAdmin } from '@/lib/auth';
import { prisma } from '@/lib/db';

export const GET = handleRoute(async (req: Request) => {
  // Enforce admin auth (this checks token and rate limits admin-auth failures)
  requireAdmin(req);

  // Fetch change requests ordered by creation date descending
  const changeRequests = await prisma.changeRequest.findMany({
    include: {
      oldVersion: {
        include: {
          form: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Map database rows to the specified output format
  const formattedChangeRequests = changeRequests.map((cr) => {
    const proposedData = cr.proposedDataJson as any;
    const targetVersion = proposedData?.targetVersion ?? '';

    return {
      id: cr.id,
      status: cr.status,
      sourceUrl: cr.sourceUrl,
      diff: cr.diffJson,
      proposedTargetVersion: targetVersion,
      oldVersion: {
        formCode: cr.oldVersion.form.code,
        version: cr.oldVersion.version,
      },
      createdAt: cr.createdAt,
      reviewedBy: cr.reviewedBy,
      reviewedAt: cr.reviewedAt,
    };
  });

  return jsonOk({ changeRequests: formattedChangeRequests });
});