'use client';

import { useEffect, useState } from 'react';
import { DEFAULT_TTS_MODE, isTtsMode, type TtsMode } from '@/lib/tts-mode';

// Module-level memo so the many SpeechButtons on a page share a single /config
// request per page load. The mode is treated as stable for the page's lifetime;
// an admin change takes effect on the next load.
let cachedMode: TtsMode | null = null;
let inflight: Promise<TtsMode> | null = null;

async function loadTtsMode(): Promise<TtsMode> {
  if (cachedMode !== null) {
    return cachedMode;
  }
  if (!inflight) {
    inflight = (async (): Promise<TtsMode> => {
      try {
        const res = await fetch('/api/v1/config');
        if (res.ok) {
          const data = await res.json();
          if (data && isTtsMode(data.ttsMode)) {
            cachedMode = data.ttsMode;
            return data.ttsMode;
          }
        }
      } catch {
        // Network/parse failure -> fall back to the free default.
      }
      return DEFAULT_TTS_MODE;
    })();
  }
  const mode = await inflight;
  inflight = null;
  return mode;
}

/**
 * Current TTS delivery mode for the client. Returns the default until /config
 * resolves, so playback never blocks on it.
 */
export function useTtsMode(): TtsMode {
  const [mode, setMode] = useState<TtsMode>(cachedMode ?? DEFAULT_TTS_MODE);
  useEffect(() => {
    let active = true;
    loadTtsMode().then((m) => {
      if (active) {
        setMode(m);
      }
    });
    return () => {
      active = false;
    };
  }, []);
  return mode;
}
