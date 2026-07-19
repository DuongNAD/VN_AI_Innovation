import { execFile } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join } from 'node:path';

const MAX_PDF_PAGES = 20;
const MAX_RENDERED_PAGES = 6;
const MAX_RENDERED_IMAGE_BYTES = 4 * 1024 * 1024;
const MAX_RENDERED_TOTAL_BYTES = 12 * 1024 * 1024;
// A scanned declaration can be considerably heavier after it has been
// downloaded, signed and scanned again. Keep these bounded, but do not apply
// the very small defaults that are suitable only for simple generated PDFs.
const POPPLER_TIMEOUT_MS = 45_000;
const POPPLER_MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

export class PdfVisionError extends Error {
  constructor(
    readonly kind: 'invalid' | 'unavailable',
    message: string
  ) {
    super(message);
    this.name = 'PdfVisionError';
    // Keep instanceof reliable when this module crosses a transpiled/server
    // bundle boundary (notably during Next.js development hot reloads).
    Object.setPrototypeOf(this, PdfVisionError.prototype);
  }
}

export function isPdfVisionError(error: unknown): error is PdfVisionError {
  if (error instanceof PdfVisionError) {
    return true;
  }
  if (!error || typeof error !== 'object') {
    return false;
  }
  const candidate = error as { name?: unknown; kind?: unknown; message?: unknown };
  return (
    candidate.name === 'PdfVisionError' &&
    (candidate.kind === 'invalid' || candidate.kind === 'unavailable') &&
    typeof candidate.message === 'string'
  );
}

type CommandResult = { stdout: string; stderr: string };

export function resolvePopplerExecutable(command: 'pdfinfo' | 'pdftoppm'): string {
  const configuredDir = process.env.POPPLER_BIN_DIR?.trim();
  if (!configuredDir) {
    return command;
  }
  if (!isAbsolute(configuredDir)) {
    throw new PdfVisionError(
      'unavailable',
      'Cấu hình thư mục Poppler phải là đường dẫn tuyệt đối.'
    );
  }
  const executable = process.platform === 'win32' ? `${command}.exe` : command;
  return join(configuredDir, executable);
}

function runPoppler(command: 'pdfinfo' | 'pdftoppm', args: string[]): Promise<CommandResult> {
  return new Promise((resolve, reject) => {
    const executable = resolvePopplerExecutable(command);
    execFile(
      executable,
      args,
      {
        encoding: 'utf8',
        timeout: POPPLER_TIMEOUT_MS,
        maxBuffer: POPPLER_MAX_OUTPUT_BYTES,
        env: {
          PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
          LC_ALL: 'C',
          NODE_ENV: process.env.NODE_ENV || 'production',
          // Fontconfig is used by Poppler even for image-only PDFs. Without a
          // writable cache it can emit hundreds of KB of warnings and make
          // execFile abort with ERR_CHILD_PROCESS_STDIO_MAXBUFFER.
          XDG_CACHE_HOME: tmpdir(),
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
              'Máy chủ chưa tìm thấy công cụ Poppler để kiểm tra PDF.'
            )
          );
          return;
        }
        if (code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
          reject(
            new PdfVisionError(
              'unavailable',
              'PDF tạo ra quá nhiều dữ liệu khi chuyển đổi; máy chủ chưa thể kiểm tra tệp này.'
            )
          );
          return;
        }
        if ((error as NodeJS.ErrnoException & { killed?: boolean }).killed) {
          reject(
            new PdfVisionError(
              'unavailable',
              'PDF mất quá nhiều thời gian để chuyển đổi; máy chủ chưa thể kiểm tra tệp này.'
            )
          );
          return;
        }
        console.error('Poppler command failed:', {
          command,
          code: code ?? 'UNKNOWN',
          signal: (error as NodeJS.ErrnoException & { signal?: string }).signal ?? null,
          stderr: String(stderr || '').trim().slice(0, 500),
        });
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
    // Cleanup is best-effort. On Windows, antivirus/indexing can briefly retain
    // a handle after Poppler exits; that must not turn a successful render into
    // a failed citizen upload.
    try {
      await rm(workDir, { recursive: true, force: true });
    } catch (error) {
      console.error(
        'PDF vision temporary-directory cleanup failed:',
        error instanceof Error ? error.message : String(error)
      );
    }
  }
}
