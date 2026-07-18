import { describe, it, expect, beforeAll } from 'vitest';
import { makeSynthesisCacheKey, getConfiguredTtsModel } from '@/lib/ai/tts';
import { isTtsMode, TTS_MODES, DEFAULT_TTS_MODE } from '@/lib/tts-mode';

// The synthesize route and the pre-generation CLI share makeSynthesisCacheKey;
// these guard that contract so warmed audio can't silently stop matching runtime.
beforeAll(() => {
  process.env.AI_PROVIDER = 'mock';
});

describe('makeSynthesisCacheKey', () => {
  const base = { text: 'Xin chào', voice: 'vi-female', speed: 1, language: 'vi' };

  it('is deterministic for identical inputs', () => {
    expect(makeSynthesisCacheKey(base)).toBe(makeSynthesisCacheKey({ ...base }));
  });

  it('is namespaced by provider and model', () => {
    expect(getConfiguredTtsModel('mock')).toBe('mock-tts');
    expect(makeSynthesisCacheKey(base).startsWith('mock:mock-tts:tts:')).toBe(true);
  });

  it('changes when any input changes', () => {
    const k = makeSynthesisCacheKey(base);
    expect(makeSynthesisCacheKey({ ...base, text: 'Khác' })).not.toBe(k);
    expect(makeSynthesisCacheKey({ ...base, voice: 'vi-male' })).not.toBe(k);
    expect(makeSynthesisCacheKey({ ...base, speed: 1.5 })).not.toBe(k);
    expect(makeSynthesisCacheKey({ ...base, language: 'en' })).not.toBe(k);
  });
});

describe('isTtsMode', () => {
  it('accepts the allowed modes and rejects everything else', () => {
    for (const m of TTS_MODES) {
      expect(isTtsMode(m)).toBe(true);
    }
    expect(isTtsMode('server')).toBe(false);
    expect(isTtsMode('')).toBe(false);
    expect(isTtsMode(undefined)).toBe(false);
    expect(isTtsMode(1)).toBe(false);
    expect(DEFAULT_TTS_MODE).toBe('browser');
  });
});
