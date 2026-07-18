import { handleRoute, jsonOk } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { getTtsMode } from '@/lib/settings';

export const dynamic = 'force-dynamic';

/**
 * Public, non-sensitive client configuration. Read once per page load by the
 * read-aloud UI to decide how to speak (browser vs. server TTS). No session is
 * required; it is rate-limited to keep it from being abused as free DB traffic.
 */
export const GET = handleRoute(async (req: Request) => {
  enforceRateLimit('config', req, { limit: 60, windowMs: 60000 });
  const ttsMode = await getTtsMode();
  return jsonOk({ ttsMode });
});
