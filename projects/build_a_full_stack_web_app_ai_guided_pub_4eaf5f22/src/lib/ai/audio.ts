import { parseBuffer } from 'music-metadata';
import { AppError } from '../errors';

export async function inspectAudio(
  buf: Buffer
): Promise<{ mimeType: string; durationSeconds: number; durationIsEstimate: boolean }> {
  try {
    const metadata = await parseBuffer(buf, undefined, { duration: true });
    const container = (metadata.format?.container || '').toLowerCase();

    let mimeType = '';
    if (container.includes('wave')) {
      mimeType = 'audio/wav';
    } else if (container.includes('ogg')) {
      mimeType = 'audio/ogg';
    } else if (
      container.includes('ebml') ||
      container.includes('matroska') ||
      container.includes('webm')
    ) {
      mimeType = 'audio/webm';
    } else if (container.includes('mpeg')) {
      mimeType = 'audio/mpeg';
    } else if (
      container.includes('mp4') ||
      container.includes('m4a') ||
      container.includes('isom')
    ) {
      mimeType = 'audio/mp4';
    } else {
      throw new AppError(400, 'UNSUPPORTED_AUDIO_TYPE', 'Định dạng âm thanh không được hỗ trợ.');
    }

    const duration = metadata.format?.duration;
    if (typeof duration === 'number' && Number.isFinite(duration) && duration > 0) {
      return { mimeType, durationSeconds: duration, durationIsEstimate: false };
    }

    // Streamed MediaRecorder WebM has no SegmentInfo Duration element, so the
    // parser cannot report a duration for exactly the uploads our own voice
    // fallback produces. The route already enforces a byte cap; estimate the
    // length from size (~16 kB/s Opus) instead of rejecting the recording.
    return {
      mimeType,
      durationSeconds: Math.max(1, Math.ceil(buf.length / 16000)),
      durationIsEstimate: true,
    };
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError(400, 'UNSUPPORTED_AUDIO_TYPE', 'Định dạng âm thanh không được hỗ trợ.');
  }
}
