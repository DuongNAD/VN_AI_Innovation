import { Buffer } from 'buffer';
import { getOpenAiBaseUrl, getOpenAiKey } from '@/lib/config';

export class UpstreamError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'UpstreamError';
    Object.setPrototypeOf(this, UpstreamError.prototype);
  }
}

const APPROVED_PATHS: ReadonlySet<string> = Object.freeze(
  new Set(['/chat/completions', '/audio/transcriptions', '/audio/speech'])
);

const BINARY_PREFIX_ALLOWLIST: ReadonlySet<string> = Object.freeze(
  new Set(['audio/'])
);

function parseMediaType(header: string | null | undefined): string {
  if (!header) {
    return '';
  }
  const index = header.indexOf(';');
  const mediaType = index === -1 ? header : header.substring(0, index);
  return mediaType.trim().toLowerCase();
}

function buildUpstreamUrl(path: string): URL {
  if (!APPROVED_PATHS.has(path)) {
    throw new UpstreamError('invalid upstream path');
  }

  let baseUrl: URL;
  try {
    baseUrl = new URL(getOpenAiBaseUrl());
  } catch (_) {
    throw new UpstreamError('invalid base URL');
  }

  const finalUrl = new URL(baseUrl.href);
  let basePath = baseUrl.pathname;
  while (basePath.endsWith('/')) {
    basePath = basePath.slice(0, -1);
  }
  finalUrl.pathname = basePath + path;

  if (
    finalUrl.protocol !== baseUrl.protocol ||
    finalUrl.hostname !== baseUrl.hostname ||
    finalUrl.port !== baseUrl.port ||
    finalUrl.username !== '' ||
    finalUrl.password !== '' ||
    finalUrl.search !== '' ||
    finalUrl.hash !== ''
  ) {
    throw new UpstreamError('invalid final URL');
  }

  return finalUrl;
}

export async function fetchUpstreamJson(
  path: string,
  init: { method: string; headers?: Record<string, string>; body?: BodyInit },
  opts?: { timeoutMs?: number; maxBytes?: number }
): Promise<unknown> {
  const url = buildUpstreamUrl(path);

  const timeoutMs = opts?.timeoutMs ?? 30000;
  const maxBytes = opts?.maxBytes ?? 1048576; // 1 MiB

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  let res: Response;
  try {
    const key = getOpenAiKey();
    res = await fetch(url.href, {
      method: init.method,
      headers: {
        ...init.headers,
        'Authorization': `Bearer ${key}`,
      },
      body: init.body,
      signal: controller.signal,
      redirect: 'error',
    });
  } catch (err: any) {
    if (err instanceof UpstreamError) {
      throw err;
    }
    if (err && (err.name === 'AbortError' || err.name === 'TimeoutError' || controller.signal.aborted)) {
      throw new UpstreamError('upstream timeout');
    }
    throw new UpstreamError('upstream network error');
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    if (res.body) {
      try {
        await res.body.cancel();
      } catch (_) {}
    }
    throw new UpstreamError(`upstream status error: ${res.status}`);
  }

  const parsedContentType = parseMediaType(res.headers.get('content-type'));
  if (parsedContentType !== 'application/json') {
    if (res.body) {
      try {
        await res.body.cancel();
      } catch (_) {}
    }
    throw new UpstreamError('invalid media type');
  }

  const contentLengthHeader = res.headers.get('content-length');
  if (contentLengthHeader !== null) {
    const parsedLength = parseInt(contentLengthHeader, 10);
    if (!Number.isNaN(parsedLength) && parsedLength > maxBytes) {
      if (res.body) {
        try {
          await res.body.cancel();
        } catch (_) {}
      }
      throw new UpstreamError('response too large');
    }
  }

  let buffer: Buffer;
  try {
    const arrayBuffer = await res.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } catch (_) {
    throw new UpstreamError('failed to read response body');
  }

  const text = buffer.toString('utf-8');
  if (Buffer.byteLength(text, 'utf-8') > maxBytes) {
    throw new UpstreamError('response too large');
  }

  try {
    return JSON.parse(text);
  } catch (_) {
    throw new UpstreamError('invalid upstream JSON');
  }
}

export async function fetchUpstreamBinary(
  path: string,
  init: { method: string; headers?: Record<string, string>; body?: BodyInit },
  opts?: { timeoutMs?: number; maxBytes?: number; contentTypePrefix?: string }
): Promise<{ buffer: Buffer; contentType: string }> {
  const resolvedPrefix = opts?.contentTypePrefix !== undefined ? opts.contentTypePrefix : 'audio/';
  if (!BINARY_PREFIX_ALLOWLIST.has(resolvedPrefix)) {
    throw new UpstreamError('invalid contentTypePrefix');
  }

  const url = buildUpstreamUrl(path);

  const timeoutMs = opts?.timeoutMs ?? 30000;
  const maxBytes = opts?.maxBytes ?? 10485760; // 10 MiB

  const controller = new AbortController();
  const timer = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  let res: Response;
  try {
    const key = getOpenAiKey();
    res = await fetch(url.href, {
      method: init.method,
      headers: {
        ...init.headers,
        'Authorization': `Bearer ${key}`,
      },
      body: init.body,
      signal: controller.signal,
      redirect: 'error',
    });
  } catch (err: any) {
    if (err instanceof UpstreamError) {
      throw err;
    }
    if (err && (err.name === 'AbortError' || err.name === 'TimeoutError' || controller.signal.aborted)) {
      throw new UpstreamError('upstream timeout');
    }
    throw new UpstreamError('upstream network error');
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    if (res.body) {
      try {
        await res.body.cancel();
      } catch (_) {}
    }
    throw new UpstreamError(`upstream status error: ${res.status}`);
  }

  const parsedContentType = parseMediaType(res.headers.get('content-type'));
  if (!parsedContentType.startsWith(resolvedPrefix)) {
    if (res.body) {
      try {
        await res.body.cancel();
      } catch (_) {}
    }
    throw new UpstreamError('invalid media type');
  }

  const contentLengthHeader = res.headers.get('content-length');
  if (contentLengthHeader !== null) {
    const parsedLength = parseInt(contentLengthHeader, 10);
    if (!Number.isNaN(parsedLength) && parsedLength > maxBytes) {
      if (res.body) {
        try {
          await res.body.cancel();
        } catch (_) {}
      }
      throw new UpstreamError('response too large');
    }
  }

  let buffer: Buffer;
  try {
    const arrayBuffer = await res.arrayBuffer();
    buffer = Buffer.from(arrayBuffer);
  } catch (_) {
    throw new UpstreamError('failed to read response body');
  }

  if (buffer.byteLength > maxBytes) {
    throw new UpstreamError('response too large');
  }

  return { buffer, contentType: parsedContentType };
}