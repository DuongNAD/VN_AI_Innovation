import { handleRoute, jsonOk } from '@/lib/errors';
import { requireAdmin } from '@/lib/auth';
import { getProvider } from '@/lib/data-provider';
import { getUsageSummary } from '@/lib/ai/usage';
import { getTtsMode } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export const GET = handleRoute(async (req: Request) => {
  requireAdmin(req);

  const procedures = await getProvider().getCatalogOverview();
  const usage = await getUsageSummary();
  const ttsMode = await getTtsMode();

  return jsonOk({
    procedures,
    usage: {
      services: usage,
    },
    settings: {
      ttsMode,
    },
  });
});
