import { AppError, handleRoute, jsonOk } from '@/lib/errors';
import { requireStaffAuth } from '@/lib/login-auth';
import { prisma } from '@/lib/db';
import { safeHttpsUrl } from '@/lib/schema-guards';

export const dynamic = 'force-dynamic';

/** GET change-requests — manager (read) + admin (cookie session or legacy token) */
export const GET = handleRoute(async (req: Request) => {
  await requireStaffAuth(req, 'manager');

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
    const sourceUrl = safeHttpsUrl(cr.sourceUrl);
    if (!sourceUrl) {
      throw new AppError(
        500,
        'DATA_INTEGRITY',
        'Nguồn của yêu cầu thay đổi không hợp lệ.'
      );
    }

    return {
      id: cr.id,
      status: cr.status,
      sourceUrl,
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
