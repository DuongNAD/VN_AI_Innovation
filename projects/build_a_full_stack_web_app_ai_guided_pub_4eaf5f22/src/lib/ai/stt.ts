import { getAiProvider } from '@/lib/config';
import { fetchUpstreamJson, UpstreamError } from '@/lib/ai/upstream';
import { logAiUsage } from '@/lib/ai/usage';

export interface SttProvider {
  readonly name: string;
  transcribe(
    audio: Buffer,
    mimeType: string,
    language: string,
    durationSeconds: number
  ): Promise<{ text: string; model: string; audioSeconds: number }>;
}

export const mockStt: SttProvider = {
  name: 'mock',
  async transcribe(
    audio: Buffer,
    mimeType: string,
    language: string,
    durationSeconds: number
  ): Promise<{ text: string; model: string; audioSeconds: number }> {
    const startTime = Date.now();
    const latencyMs = Date.now() - startTime;

    logAiUsage({
      serviceType: 'stt',
      model: 'mock-stt',
      audioSeconds: durationSeconds,
      latencyMs,
    });

    return {
      text: 'Tôi muốn đăng ký kết hôn',
      model: 'mock-stt',
      audioSeconds: durationSeconds,
    };
  },
};

const openAiStt: SttProvider = {
  name: 'openai',
  async transcribe(
    audio: Buffer,
    mimeType: string,
    language: string,
    durationSeconds: number
  ): Promise<{ text: string; model: string; audioSeconds: number }> {
    const startTime = Date.now();
    const model = process.env.STT_MODEL || 'whisper-1';

    const formData = new FormData();
    const ext = mimeType.split('/')[1] || 'wav';
    const file = new Blob([new Uint8Array(audio)], { type: mimeType });

    formData.append('file', file, `audio.${ext}`);
    formData.append('model', model);
    formData.append('language', language);

    const response = await fetchUpstreamJson('/audio/transcriptions', {
      method: 'POST',
      body: formData,
    });

    const latencyMs = Date.now() - startTime;

    if (!response || typeof response !== 'object') {
      throw new UpstreamError('Invalid STT response');
    }

    const text = (response as Record<string, any>).text;
    if (typeof text !== 'string' || text.length > 10000) {
      throw new UpstreamError('Invalid or too long transcription text');
    }

    logAiUsage({
      serviceType: 'stt',
      model,
      audioSeconds: durationSeconds,
      latencyMs,
    });

    return {
      text,
      model,
      audioSeconds: durationSeconds,
    };
  },
};

export function getSttProvider(): SttProvider {
  const provider = getAiProvider();
  return provider === 'openai' ? openAiStt : mockStt;
}