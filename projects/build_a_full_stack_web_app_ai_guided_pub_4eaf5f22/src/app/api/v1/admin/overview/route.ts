import { handleRoute, jsonOk } from '@/lib/errors';
import { requireStaffAuth } from '@/lib/login-auth';
import { getProvider } from '@/lib/data-provider';
import { getUsageSummary } from '@/lib/ai/usage';

/** GET overview — manager (read) + admin (cookie session or legacy token) */
export const GET = handleRoute(async (req: Request) => {
  const { role, user } = await requireStaffAuth(req, 'manager');

  const procedures = await getProvider().getCatalogOverview();
  const usage = await getUsageSummary();

  return jsonOk({
    procedures,
    usage,
    role,
    actor: user ? { id: user.id, displayName: user.displayName, username: user.username } : null,
  });
});