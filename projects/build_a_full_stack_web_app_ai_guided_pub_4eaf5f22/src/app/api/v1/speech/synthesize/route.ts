import { handleRoute, AppError } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { readJsonBody, requireString, optionalString } from '@/lib/http';
import { requireLiveSession } from '@/lib/auth';
import { getAuthUserFromRequest } from '@/lib/login-auth';
import { LIMITS } from '@/lib/constants';
import { TTS_VOICES, getTtsProvider, makeSynthesisCacheKey } from '@/lib/ai/tts';
import { ttsCacheGet, ttsCacheSet } from '@/lib/ai/tts-cache';
import { UpstreamError } from '@/lib/ai/upstream';
import { logAiUsage } from '@/lib/ai/usage';

export const POST = handleRoute(async (req: Request) => {
  const startTime = Date.now();

  enforceRateLimit('synthesize', req);
  // Nút "Nghe" xuất hiện từ màn chào (chưa có phiên intake): chấp nhận phiên
  // intake HOẶC tài khoản đã đăng nhập; rate-limit vẫn áp dụng.
  if (req.headers.get('x-session-token')) {
    await requireLiveSession(req);
  } else {
    const user = await getAuthUserFromRequest(req);
    if (!user) {
      throw new AppError(401, 'UNAUTHORIZED', 'Phiên truy cập không hợp lệ hoặc đã hết hạn.');
    }
  }

  const provider = getTtsProvider();
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

  const key = makeSynthesisCacheKey({ text, voice, speed, language });

  const cached = await ttsCacheGet(key);
  if (cached) {
    const latencyMs = Date.now() - startTime;
    logAiUsage({
      serviceType: 'tts',
      model: cached.model,
      cacheHit: true,
      latencyMs,
    });

    return new Response(cached.audio as unknown as BodyInit, {
      status: 200,
      headers: {
        'Content-Type': cached.mimeType,
        'X-Cache-Hit': 'true',
        'X-Cache-Tier': cached.tier,
        'X-Model': cached.model,
        'Cache-Control': 'no-store, private',
        'Pragma': 'no-cache',
      },
    });
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

  // Persist to the durable (Postgres) + in-process cache. The module bounds entry
  // size and storage, and swallows DB errors so caching never breaks the response.
  await ttsCacheSet(key, {
    audio: result.audio,
    mimeType: result.mimeType,
    model: result.model,
  });

  return new Response(result.audio as unknown as BodyInit, {
    status: 200,
    headers: {
      'Content-Type': result.mimeType,
      'X-Cache-Hit': 'false',
      'X-Cache-Tier': 'miss',
      'X-Model': result.model,
      'Cache-Control': 'no-store, private',
      'Pragma': 'no-cache',
    },
  });
});
