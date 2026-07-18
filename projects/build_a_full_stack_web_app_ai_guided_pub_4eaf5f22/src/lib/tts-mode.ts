/**
 * TTS delivery mode constants — client-safe (no DB imports), so both the browser
 * UI and server code can share one definition:
 *  - 'browser': speak with the browser's built-in speechSynthesis (free); fall
 *    back to the server TTS API only when the browser has none.
 *  - 'fpt': always use the server (FPT) TTS API for a consistent premium voice.
 */
export const TTS_MODES = ['browser', 'fpt'] as const;
export type TtsMode = (typeof TTS_MODES)[number];

// Preserves the app's current, free-by-default behaviour when unset.
export const DEFAULT_TTS_MODE: TtsMode = 'browser';

export function isTtsMode(value: unknown): value is TtsMode {
  return typeof value === 'string' && (TTS_MODES as readonly string[]).includes(value);
}
