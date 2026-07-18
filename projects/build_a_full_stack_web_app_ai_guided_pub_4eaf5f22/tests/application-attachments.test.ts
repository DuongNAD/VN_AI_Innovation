import { describe, expect, it } from 'vitest';
import {
  attachmentContentDisposition,
  detectSafeAttachmentMime,
  sanitizeAttachmentFileName,
} from '@/lib/application-attachments';

describe('application attachments', () => {
  it('detects the supported preview formats from file signatures', () => {
    expect(detectSafeAttachmentMime(new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])))
      .toBe('application/pdf');
    expect(detectSafeAttachmentMime(new Uint8Array([0xff, 0xd8, 0xff, 0x00])))
      .toBe('image/jpeg');
    expect(
      detectSafeAttachmentMime(
        new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      )
    ).toBe('image/png');
    expect(
      detectSafeAttachmentMime(
        new Uint8Array([
          0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
        ])
      )
    ).toBe('image/webp');
  });

  it('rejects a renamed script or backup file', () => {
    expect(detectSafeAttachmentMime(new TextEncoder().encode('research.md.bak')))
      .toBeNull();
  });

  it('sanitizes file names and builds a safe content disposition', () => {
    expect(sanitizeAttachmentFileName('../Văn bản ủy quyền.pdf'))
      .toBe('Văn bản ủy quyền.pdf');
    const header = attachmentContentDisposition('Văn bản ủy quyền.pdf', 'inline');
    expect(header).toContain('inline;');
    expect(header).not.toContain('\r');
    expect(header).not.toContain('\n');
    expect(header).toContain("filename*=UTF-8''");
  });
});
