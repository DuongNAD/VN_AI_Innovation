import { Buffer } from 'buffer';
import { sha256hex } from '@/lib/auth';
import { getAiProvider } from '@/lib/config';
import { logAiUsage } from '@/lib/ai/usage';
import { fetchUpstreamBinary } from '@/lib/ai/upstream';

export const TTS_VOICES = ['vi-female', 'vi-male'] as const;

export interface TtsProvider {
  readonly name: string;
  synthesize(
    text: string,
    voice: string,
    speed: number,
    language: string
  ): Promise<{
    audio: Buffer;
    mimeType: string;
    model: string;
    audioSeconds: number;
  }>;
}

class MockTtsProvider implements TtsProvider {
  readonly name = 'mock';

  async synthesize(
    text: string,
    voice: string,
    speed: number,
    language: string
  ): Promise<{
    audio: Buffer;
    mimeType: string;
    model: string;
    audioSeconds: number;
  }> {
    const startTime = Date.now();
    const duration = Math.max(0.5, Math.min(3, text.length * 0.05));
    const numSamples = Math.floor(duration * 8000);
    const subChunk2Size = numSamples * 2;
    const chunkSize = 36 + subChunk2Size;
    const audio = Buffer.alloc(44 + subChunk2Size);

    // Write WAV header
    audio.write('RIFF', 0);
    audio.writeUInt32LE(chunkSize, 4);
    audio.write('WAVE', 8);
    audio.write('fmt ', 12);
    audio.writeUInt32LE(16, 16);
    audio.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
    audio.writeUInt16LE(1, 22); // NumChannels (1 = Mono)
    audio.writeUInt32LE(8000, 24); // SampleRate
    audio.writeUInt32LE(16000, 28); // ByteRate (8000 * 1 * 16 / 8)
    audio.writeUInt16LE(2, 32); // BlockAlign (1 * 16 / 8)
    audio.writeUInt16LE(16, 34); // BitsPerSample (16)
    audio.write('data', 36);
    audio.writeUInt32LE(subChunk2Size, 40);

    const hash = sha256hex(text);
    const first8 = hash.slice(0, 8);
    const freq = 200 + (parseInt(first8, 16) % 400);

    for (let i = 0; i < numSamples; i++) {
      const t = i / 8000;
      const sampleVal = Math.floor(Math.sin(2 * Math.PI * freq * t) * 16383);
      audio.writeInt16LE(sampleVal, 44 + i * 2);
    }

    const latencyMs = Date.now() - startTime;
    logAiUsage({
      serviceType: 'tts',
      model: 'mock-tts',
      audioSeconds: duration,
      latencyMs,
      cacheHit: false,
      degraded: false,
    });

    return {
      audio,
      mimeType: 'audio/wav',
      model: 'mock-tts',
      audioSeconds: duration,
    };
  }
}

class OpenAiTtsProvider implements TtsProvider {
  readonly name = 'openai';

  async synthesize(
    text: string,
    voice: string,
    speed: number,
    language: string
  ): Promise<{
    audio: Buffer;
    mimeType: string;
    model: string;
    audioSeconds: number;
  }> {
    const startTime = Date.now();
    // Upstream voice ids differ per provider (OpenAI: nova/onyx; FPT.AI-VITs:
    // banmai/leminh/...), so the app-facing vi-female/vi-male ids map through env.
    const femaleVoice = process.env.TTS_VOICE_FEMALE?.trim() || 'nova';
    const maleVoice = process.env.TTS_VOICE_MALE?.trim() || 'onyx';
    const mappedVoice = voice === 'vi-female' ? femaleVoice : voice === 'vi-male' ? maleVoice : voice;
    const model = process.env.TTS_MODEL || 'tts-1';
    const audioSeconds = text.length * 0.05;

    const res = await fetchUpstreamBinary(
      '/audio/speech',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          input: text,
          voice: mappedVoice,
          speed,
        }),
      },
      {
        contentTypePrefix: 'audio/',
      }
    );

    const latencyMs = Date.now() - startTime;
    logAiUsage({
      serviceType: 'tts',
      model,
      audioSeconds,
      latencyMs,
      cacheHit: false,
      degraded: false,
    });

    return {
      audio: res.buffer,
      mimeType: res.contentType,
      model,
      audioSeconds,
    };
  }
}

export const mockTts: TtsProvider = new MockTtsProvider();
const openAiTts: TtsProvider = new OpenAiTtsProvider();

export function getTtsProvider(): TtsProvider {
  const provider = getAiProvider();
  if (provider === 'openai') {
    return openAiTts;
  }
  return mockTts;
}

export function makeTtsCacheKey(
  text: string,
  voice: string,
  speed: number,
  language: string
): string {
  return 'tts:' + sha256hex(JSON.stringify([text, voice, speed, language]));
}

/**
 * The upstream model id the current provider synthesizes with. Upstream voice ids
 * differ per provider, but the model label is what varies the cache key/pricing.
 */
export function getConfiguredTtsModel(providerName: string): string {
  return providerName === 'openai'
    ? (process.env.TTS_MODEL?.trim() || 'tts-1')
    : 'mock-tts';
}

/**
 * Full durable-cache key for a synthesis request, namespaced by provider + model
 * so a provider/model switch never serves stale audio. The single source of truth
 * for this key — the route and the pre-generation CLI both call it, so warmed
 * entries are guaranteed to match what runtime looks up.
 */
export function makeSynthesisCacheKey(params: {
  text: string;
  voice: string;
  speed: number;
  language: string;
}): string {
  const providerName = getTtsProvider().name;
  const model = getConfiguredTtsModel(providerName);
  return `${providerName}:${model}:${makeTtsCacheKey(params.text, params.voice, params.speed, params.language)}`;
}