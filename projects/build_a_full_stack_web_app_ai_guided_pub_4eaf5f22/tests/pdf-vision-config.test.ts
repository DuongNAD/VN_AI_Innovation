import { afterEach, describe, expect, it } from 'vitest';
import {
  isPdfVisionError,
  PdfVisionError,
  resolvePopplerExecutable,
} from '@/lib/ai/pdf-vision';

const originalPopplerBinDir = process.env.POPPLER_BIN_DIR;

afterEach(() => {
  if (originalPopplerBinDir === undefined) {
    delete process.env.POPPLER_BIN_DIR;
  } else {
    process.env.POPPLER_BIN_DIR = originalPopplerBinDir;
  }
});

describe('PDF vision · Poppler executable resolution', () => {
  it('uses PATH when no explicit directory is configured', () => {
    delete process.env.POPPLER_BIN_DIR;
    expect(resolvePopplerExecutable('pdfinfo')).toBe('pdfinfo');
    expect(resolvePopplerExecutable('pdftoppm')).toBe('pdftoppm');
  });

  it('uses the configured absolute Poppler directory', () => {
    process.env.POPPLER_BIN_DIR =
      process.platform === 'win32' ? 'C:\\tools\\poppler\\bin' : '/opt/poppler/bin';

    const suffix = process.platform === 'win32' ? '.exe' : '';
    expect(resolvePopplerExecutable('pdfinfo')).toContain(`pdfinfo${suffix}`);
    expect(resolvePopplerExecutable('pdftoppm')).toContain(`pdftoppm${suffix}`);
  });

  it('rejects a relative executable directory', () => {
    process.env.POPPLER_BIN_DIR = 'tools/poppler';
    expect(() => resolvePopplerExecutable('pdfinfo')).toThrow(PdfVisionError);
  });
});

describe('PDF vision · error classification', () => {
  it('recognizes the local error class', () => {
    expect(isPdfVisionError(new PdfVisionError('invalid', 'PDF không hợp lệ.'))).toBe(true);
  });

  it('recognizes the same safe error shape across a server bundle boundary', () => {
    const bundledError = {
      name: 'PdfVisionError',
      kind: 'unavailable',
      message: 'Poppler tạm thời không khả dụng.',
    };
    expect(isPdfVisionError(bundledError)).toBe(true);
  });

  it('does not classify arbitrary errors as PDF renderer errors', () => {
    expect(isPdfVisionError(new Error('unexpected'))).toBe(false);
    expect(isPdfVisionError({ name: 'PdfVisionError', kind: 'other', message: 'x' })).toBe(false);
  });
});
