import { requireStaffAuth } from '@/lib/login-auth';
import { AppError, handleRoute, jsonOk } from '@/lib/errors';
import { readJsonBody } from '@/lib/http';
import { getTtsMode, setTtsMode, isTtsMode } from '@/lib/settings';

export const dynamic = 'force-dynamic';

export const GET = handleRoute(async (req: Request) => {
  await requireStaffAuth(req, 'admin');
  return jsonOk({ ttsMode: await getTtsMode() });
});

/**
 * Update runtime settings. Only the TTS delivery mode is exposed today; the
 * value is validated against the allowed set before it is persisted.
 */
export const POST = handleRoute(async (req: Request) => {
  await requireStaffAuth(req, 'admin');

  const body = await readJsonBody(req);
  const ttsMode = body.ttsMode;
  if (!isTtsMode(ttsMode)) {
    throw new AppError(400, 'INVALID_INPUT', 'Chế độ đọc không hợp lệ.', { field: 'ttsMode' });
  }

  await setTtsMode(ttsMode);
  return jsonOk({ ttsMode });
});
