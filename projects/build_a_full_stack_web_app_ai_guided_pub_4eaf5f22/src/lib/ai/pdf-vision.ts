import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const MAX_PDF_PAGES = 20;
const MAX_RENDERED_PAGES = 6;
const MAX_RENDERED_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_RENDERED_TOTAL_BYTES = 12 * 1024 * 1024;
const POPPLER_TIMEOUT_MS = 20_000;

export class PdfVisionError extends Error {
  constructor(
    readonly kind: 'invalid' | 'unavailable',
    message: string
  ) {
    super(message);
    this.name = 'PdfVisionError';
  }
}

type CommandResult = { stdout: string; stderr: string };

function runPoppler(command: 'pdfinfo' | 'pdftoppm', args: string[]): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      {
        encoding: 'utf8',
        timeout: POPPLER_TIMEOUT_MS,
        maxBuffer: 256 * 1024,
        env: {
          PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
          LC_ALL: 'C',
          NODE_ENV: process.env.NODE_ENV || 'production',
        },
      },
      (error, stdout, stderr) => {
        if (!error) {
          resolve({ stdout, stderr });
          return;
        }
        const code = (error as NodeJS.ErrnoException).code;
        if (code === 'ENOENT') {
          reject(
            new PdfVisionError(
              'unavailable',
              'Máy chủ chưa có công cụ đọc PDF để kiểm tra tự động.'
            )
          );
          return;
        }
        reject(
          new PdfVisionError(
            'invalid',
            'Không thể đọc nội dung PDF. Tệp có thể bị lỗi, được đặt mật khẩu hoặc không đúng định dạng.'
          )
        );
      }
    );
  });
}

/**
 * Keep the model input bounded while still showing it both the declaration
 * header and the signature area, which is normally on the final page.
 */
export function selectPdfPagesForVision(pageCount: number): number[] {
  if (!Number.isSafeInteger(pageCount) || pageCount < 1 || pageCount > MAX_PDF_PAGES) {
    return [];
  }
  if (pageCount <= MAX_RENDERED_PAGES) {
    return Array.from({ length: pageCount }, (_, index) => index + 1);
  }
  return [1, 2, 3, pageCount - 2, pageCount - 1, pageCount];
}

async function renderPage(
  inputPath: string,
  outputPrefix: string,
  page: number
): Promise<void> {
  await runPoppler('pdftoppm', [
    '-f',
    String(page),
    '-l',
    String(page),
    '-singlefile',
    '-jpeg',
    '-r',
    '110',
    '-jpegopt',
    'quality=75,optimize=y',
    inputPath,
    outputPrefix,
  ]);
}

/**
 * Renders a bounded set of PDF pages to JPEG for the same vision check used by
 * scanned photos. Poppler receives fixed arguments (never a shell command) and
 * all temporary data is removed in a finally block.
 */
export async function renderPdfPagesForVision(
  bytes: Uint8Array
): Promise<{ bytes: Uint8Array; mimeType: 'image/jpeg' }[]> {
  const workDir = await mkdtemp(join(tmpdir(), 'signed-declaration-'));
  const inputPath = join(workDir, 'declaration.pdf');

  try {
    await writeFile(inputPath, bytes);
    const info = await runPoppler('pdfinfo', [inputPath]);
    const pageMatch = info.stdout.match(/^Pages:\s+(\d+)\s*$/mi);
    const pageCount = pageMatch ? Number(pageMatch[1]) : 0;
    const pages = selectPdfPagesForVision(pageCount);
    if (pages.length === 0) {
      throw new PdfVisionError(
        'invalid',
        `PDF phải có từ 1 đến ${MAX_PDF_PAGES} trang để hệ thống có thể kiểm tra.`
      );
    }

    for (const page of pages) {
      await renderPage(inputPath, join(workDir, `page-${String(page).padStart(3, '0')}`), page);
    }

    const names = (await readdir(workDir))
      .filter((name) => /^page-\d+\.jpg$/i.test(name))
      .sort();
    if (names.length !== pages.length) {
      throw new PdfVisionError('invalid', 'Không thể hiển thị đầy đủ các trang PDF để kiểm tra.');
    }

    let totalBytes = 0;
    const rendered: { bytes: Uint8Array; mimeType: 'image/jpeg' }[] = [];
    for (const name of names) {
      const image = await readFile(join(workDir, name));
      totalBytes += image.byteLength;
      if (
        image.byteLength < 4 ||
        image[0] !== 0xff ||
        image[1] !== 0xd8 ||
        image[2] !== 0xff ||
        image.byteLength > MAX_RENDERED_IMAGE_BYTES ||
        totalBytes > MAX_RENDERED_TOTAL_BYTES
      ) {
        throw new PdfVisionError(
          'invalid',
          'PDF quá phức tạp hoặc không thể chuyển thành hình ảnh an toàn để kiểm tra.'
        );
      }
      rendered.push({ bytes: Uint8Array.from(image), mimeType: 'image/jpeg' });
    }
    return rendered;
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}
