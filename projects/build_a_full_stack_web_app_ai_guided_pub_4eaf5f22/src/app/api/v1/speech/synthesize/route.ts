import { handleRoute, AppError } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { readJsonBody, requireString, optionalString } from '@/lib/http';
import { requireLiveSession } from '@/lib/auth';
import { LIMITS } from '@/lib/constants';
import { TTS_VOICES, getTtsProvider, makeTtsCacheKey } from '@/lib/ai/tts';
import { UpstreamError } from '@/lib/ai/upstream';
import { cacheGet, cacheSet } from '@/lib/cache';
import { logAiUsage } from '@/lib/ai/usage';

export const POST = handleRoute(async (req: Request) => {
  const startTime = Date.now();

  enforceRateLimit('synthesize', req);
  await requireLiveSession(req);

  const provider = getTtsProvider();
  const configuredModel = provider.name === 'openai'
    ? (process.env.TTS_MODEL?.trim() || 'tts-1')
    : 'mock-tts';
  const body = await readJsonBody(req);

  let text: string;
  try {
    text = requireString(body, 'text', LIMITS.TTS_TEXT_MAX);
  } catch (err) {
    if (err instanceof AppError && err.code === 'VALUE_TOO_LONG') {
      throw new AppError(400, 'TEXT_TOO_LONG', 'Văn bản quá dài.');
    }
    throw err;
  }

  const voiceRaw = optionalString(body, 'voice');
  const voice = voiceRaw ?? 'vi-female';
  if (!TTS_VOICES.includes(voice as any)) {
    throw new AppError(400, 'INVALID_INPUT', 'Giọng đọc không hợp lệ.', { field: 'voice' });
  }

  const speed = body.speed ?? 1;
  if (typeof speed !== 'number' || !Number.isFinite(speed) || speed < 0.5 || speed > 2) {
    throw new AppError(400, 'INVALID_INPUT', 'Tốc độ đọc không hợp lệ.', { field: 'speed' });
  }

  const languageRaw = optionalString(body, 'language');
  const language = languageRaw ?? 'vi';
  if (language !== 'vi') {
    throw new AppError(400, 'INVALID_INPUT', 'Ngôn ngữ không được hỗ trợ.', { field: 'language' });
  }

  const key = `${provider.name}:${configuredModel}:${makeTtsCacheKey(text, voice, speed, language)}`;

  const cached = cacheGet(key);
  if (cached) {
    try {
      const parsed = JSON.parse(cached);
      if (
        parsed &&
        typeof parsed.b64 === 'string' &&
        typeof parsed.mimeType === 'string' &&
        typeof parsed.model === 'string'
      ) {
        const latencyMs = Date.now() - startTime;
        logAiUsage({
          serviceType: 'tts',
          model: parsed.model,
          cacheHit: true,
          latencyMs,
        });

        return new Response(Buffer.from(parsed.b64, 'base64'), {
          status: 200,
          headers: {
            'Content-Type': parsed.mimeType,
            'X-Cache-Hit': 'true',
            'X-Model': parsed.model,
            'Cache-Control': 'no-store, private',
            'Pragma': 'no-cache',
          },
        });
      }
    } catch (_) {
      // Treat as cache miss
    }
  }

  let result: { audio: Buffer; mimeType: string; model: string };

  try {
    result = await provider.synthesize(text, voice, speed, language);
  } catch (err) {
    if (err instanceof UpstreamError) {
      throw new AppError(
        503,
        'AI_SERVICE_UNAVAILABLE',
        'Dịch vụ AI tạm thời không khả dụng. Vui lòng thử lại sau.'
      );
    }
    throw err;
  }

  const b64 = result.audio.toString('base64');
  cacheSet(
    key,
    JSON.stringify({
      b64,
      mimeType: result.mimeType,
      model: result.model,
    }),
    3600
  );

  return new Response(result.audio as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': result.mimeType,
      'X-Cache-Hit': 'false',
      'X-Model': result.model,
      'Cache-Control': 'no-store, private',
      'Pragma': 'no-cache',
    },
  });
});
