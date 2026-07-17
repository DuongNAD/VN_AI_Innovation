import { handleRoute, jsonOk } from '@/lib/errors';
import { requireAdmin } from '@/lib/auth';
import { getProvider } from '@/lib/data-provider';
import { getUsageSummary } from '@/lib/ai/usage';

export const GET = handleRoute(async (req: Request) => {
  requireAdmin(req);

  const procedures = await getProvider().getCatalogOverview();
  const usage = await getUsageSummary();

  return jsonOk({
    procedures,
    usage,
  });
});