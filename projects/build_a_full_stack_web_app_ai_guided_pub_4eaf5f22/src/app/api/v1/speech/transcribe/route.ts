import { handleRoute, AppError, jsonOk } from '@/lib/errors';
import { enforceRateLimit } from '@/lib/rate-limit';
import { requireLiveSession } from '@/lib/auth';
import { LIMITS } from '@/lib/constants';
import { inspectAudio } from '@/lib/ai/audio';
import { getSttProvider } from '@/lib/ai/stt';
import { UpstreamError } from '@/lib/ai/upstream';
import { aiMeta } from '@/lib/http';
import { Buffer } from 'buffer';

async function readBodyCapped(req: Request, maxBytes: number): Promise<Uint8Array> {
  if (!req.body) {
    throw new AppError(400, 'INVALID_MULTIPART', 'Dữ liệu gửi lên không đúng định dạng multipart.');
  }

  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      let result;
      try {
        result = await reader.read();
      } catch (err) {
        throw new AppError(400, 'INVALID_MULTIPART', 'Dữ liệu gửi lên không đúng định dạng multipart.');
      }

      const { done, value } = result;
      if (done) {
        break;
      }

      if (value) {
        totalBytes += value.byteLength;
        if (totalBytes > maxBytes) {
          try {
            await reader.cancel();
          } catch (_) {}
          throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Tệp âm thanh quá lớn.');
        }
        chunks.push(value);
      }
    }
  } finally {
    reader.releaseLock();
  }

  const concatenated = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    concatenated.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return concatenated;
}

export const POST = handleRoute(async (req: Request) => {
  enforceRateLimit('transcribe', req);
  await requireLiveSession(req);

  const contentType = req.headers.get('content-type');
  if (!contentType || !contentType.toLowerCase().startsWith('multipart/form-data')) {
    throw new AppError(400, 'INVALID_MULTIPART', 'Dữ liệu gửi lên không đúng định dạng multipart.');
  }

  const cl = req.headers.get('content-length');
  if (!cl || !/^\d+$/.test(cl)) {
    throw new AppError(411, 'LENGTH_REQUIRED', 'Yêu cầu tải lên thiếu Content-Length hợp lệ.');
  }

  const contentLength = Number(cl);
  if (contentLength > LIMITS.AUDIO_PREPARSE_MAX_BYTES) {
    throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Tệp âm thanh quá lớn.');
  }

  const bytes = await readBodyCapped(req, LIMITS.AUDIO_PREPARSE_MAX_BYTES);

  let form: FormData;
  try {
    const boundaryResponse = new Response(bytes as unknown as BodyInit, {
      headers: {
        'content-type': contentType,
      },
    });
    form = await boundaryResponse.formData();
  } catch (err) {
    throw new AppError(400, 'INVALID_MULTIPART', 'Dữ liệu gửi lên không đúng định dạng multipart.');
  }

  const file = form.get('audio');
  if (!file || !(file instanceof File)) {
    throw new AppError(400, 'AUDIO_REQUIRED', 'Yêu cầu tệp âm thanh.');
  }

  if (file.size > LIMITS.AUDIO_MAX_BYTES) {
    throw new AppError(413, 'PAYLOAD_TOO_LARGE', 'Tệp âm thanh quá lớn.');
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { mimeType, durationSeconds } = await inspectAudio(buffer);

  if (durationSeconds > LIMITS.AUDIO_MAX_SECONDS) {
    throw new AppError(400, 'AUDIO_TOO_LONG', 'Đoạn ghi âm vượt quá 60 giây.');
  }

  const provider = getSttProvider();
  let result;

  try {
    result = await provider.transcribe(buffer, mimeType, 'vi', durationSeconds);
  } catch (err) {
    if (err instanceof UpstreamError) {
      throw new AppError(
        503,
        'AI_SERVICE_UNAVAILABLE',
        'Dịch vụ AI hiện không khả dụng. Vui lòng thử lại sau.'
      );
    }
    throw err;
  }

  return jsonOk({
    text: result.text,
    model: result.model,
    audioSeconds: result.audioSeconds,
    language: 'vi',
    ...aiMeta(provider.name, false),
  });
});
