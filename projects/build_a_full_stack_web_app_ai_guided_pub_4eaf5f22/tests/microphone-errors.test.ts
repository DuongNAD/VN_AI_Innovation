import { describe, expect, it } from 'vitest';
import {
  INSECURE_MICROPHONE_MESSAGE,
  microphoneErrorMessage,
} from '@/components/ChatIntake';

describe('Chat intake · microphone errors', () => {
  it('explains a blocked browser permission', () => {
    expect(microphoneErrorMessage({ name: 'NotAllowedError' })).toContain(
      'cho phép Microphone'
    );
  });

  it('distinguishes missing and busy microphones', () => {
    expect(microphoneErrorMessage({ name: 'NotFoundError' })).toContain(
      'Không tìm thấy micro'
    );
    expect(microphoneErrorMessage({ name: 'NotReadableError' })).toContain(
      'ứng dụng khác'
    );
  });

  it('explains that browser microphone capture requires HTTPS', () => {
    expect(microphoneErrorMessage({ name: 'SecurityError' })).toBe(
      INSECURE_MICROPHONE_MESSAGE
    );
    expect(INSECURE_MICROPHONE_MESSAGE).toContain('HTTPS');
  });
});
