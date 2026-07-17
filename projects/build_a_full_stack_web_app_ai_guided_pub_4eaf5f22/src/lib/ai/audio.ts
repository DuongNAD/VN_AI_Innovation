import { parseBuffer } from 'music-metadata';
import { AppError } from '../errors';

export async function inspectAudio(buf: Buffer): Promise<{ mimeType: string; durationSeconds: number }> {
  try {
    const metadata = await parseBuffer(buf);
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
    if (duration === undefined || typeof duration !== 'number' || !Number.isFinite(duration) || duration <= 0) {
      throw new AppError(400, 'AUDIO_UNREADABLE', 'Không thể đọc độ dài của tệp âm thanh.');
    }

    return {
      mimeType,
      durationSeconds: duration,
    };
  } catch (err) {
    if (err instanceof AppError) {
      throw err;
    }
    throw new AppError(400, 'UNSUPPORTED_AUDIO_TYPE', 'Định dạng âm thanh không được hỗ trợ.');
  }
}