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
    const mappedVoice = voice === 'vi-female' ? 'nova' : voice === 'vi-male' ? 'onyx' : voice;
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