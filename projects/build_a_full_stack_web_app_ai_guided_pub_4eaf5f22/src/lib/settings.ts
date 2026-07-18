import { prisma } from '@/lib/db';
import { DEFAULT_TTS_MODE, isTtsMode, type TtsMode } from '@/lib/tts-mode';

export { TTS_MODES, DEFAULT_TTS_MODE, isTtsMode, type TtsMode } from '@/lib/tts-mode';

const TTS_MODE_KEY = 'tts.mode';

/**
 * Current TTS mode. Falls back to the default when the key is absent, invalid,
 * or the settings store is unreachable (e.g. before the table is migrated), so
 * a misconfigured DB degrades to free browser TTS rather than breaking playback.
 */
export async function getTtsMode(): Promise<TtsMode> {
  try {
    const row = await prisma.appSetting.findUnique({ where: { key: TTS_MODE_KEY } });
    if (row && isTtsMode(row.value)) {
      return row.value;
    }
  } catch (err) {
    console.error('Failed to read TTS mode setting:', err);
  }
  return DEFAULT_TTS_MODE;
}

export async function setTtsMode(mode: TtsMode): Promise<void> {
  await prisma.appSetting.upsert({
    where: { key: TTS_MODE_KEY },
    create: { key: TTS_MODE_KEY, value: mode },
    update: { value: mode },
  });
}
