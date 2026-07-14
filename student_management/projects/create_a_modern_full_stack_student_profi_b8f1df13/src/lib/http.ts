/**
 * Shared HTTP request guards for the API route handlers.
 *
 * Both route files import these helpers; the module implements exactly the
 * contract their call sites rely on:
 *   - guardWrite(request, opts) -> NextResponse | null   (null = proceed)
 *   - readLimitedJson(request)  -> { kind: 'ok', data } |
 *                                  { kind: 'too_large' } | { kind: 'invalid' }
 *
 * Scope note: per the approved design this app is local-only (no
 * authentication by design); these guards are defense-in-depth against
 * cross-origin/DNS-rebinding writes and oversized payloads, not an auth
 * system.
 */
import { NextResponse } from 'next/server';

/** Hard cap for JSON request bodies (64 KiB is generous for this schema). */
export const MAX_BODY_BYTES = 64 * 1024;

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

function hostnameOf(value: string | null): string | null {
  if (!value) {
    return null;
  }
  try {
    // `value` may be a bare host header ("localhost:3000") or a full origin.
    const url = value.includes('://') ? new URL(value) : new URL(`http://${value}`);
    return url.hostname;
  } catch {
    return null;
  }
}

export interface GuardWriteOptions {
  /** Require a JSON content type before the body is ever read. */
  requireJsonBody?: boolean;
}

/**
 * Reject write requests that could not have come from the local app itself.
 *
 * Returns a ready-to-return NextResponse when the request is blocked, or
 * `null` when the handler may proceed. Checks, in order: loopback request
 * host (DNS-rebinding), same-origin Origin header when present (CSRF), and
 * a JSON content type when the route expects a body.
 */
export function guardWrite(
  request: Request,
  options: GuardWriteOptions = {},
): NextResponse | null {
  // Tests and some runtimes construct Request objects without a Host
  // header; the request URL's hostname is the same trust signal there.
  const host =
    hostnameOf(request.headers.get('host')) ?? hostnameOf(request.url);
  if (!host || !LOOPBACK_HOSTS.has(host)) {
    return NextResponse.json(
      { error: 'Writes are only accepted from the local application host' },
      { status: 403 },
    );
  }

  const origin = request.headers.get('origin');
  if (origin) {
    const originHost = hostnameOf(origin);
    if (!originHost || !LOOPBACK_HOSTS.has(originHost)) {
      return NextResponse.json(
        { error: 'Cross-origin write requests are not allowed' },
        { status: 403 },
      );
    }
  }

  if (options.requireJsonBody) {
    const contentType = request.headers.get('content-type') ?? '';
    if (!contentType.toLowerCase().includes('application/json')) {
      return NextResponse.json(
        { error: 'Content-Type must be application/json' },
        { status: 415 },
      );
    }
  }

  return null;
}

export type LimitedJsonResult =
  | { kind: 'ok'; data: unknown }
  | { kind: 'too_large' }
  | { kind: 'invalid' };

/**
 * Read and parse a JSON body without ever buffering more than
 * MAX_BODY_BYTES: the stream is consumed incrementally and abandoned the
 * moment the cap is exceeded, so an oversized payload cannot exhaust memory.
 */
export async function readLimitedJson(
  request: Request,
): Promise<LimitedJsonResult> {
  const declared = Number(request.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return { kind: 'too_large' };
  }

  const body = request.body;
  let text: string;
  if (!body) {
    // Environments (and tests) that deliver a pre-buffered body.
    try {
      text = await request.text();
    } catch {
      return { kind: 'invalid' };
    }
    if (text.length > MAX_BODY_BYTES) {
      return { kind: 'too_large' };
    }
  } else {
    const reader = body.getReader();
    const chunks: Uint8Array[] = [];
    let received = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        if (value) {
          received += value.byteLength;
          if (received > MAX_BODY_BYTES) {
            await reader.cancel();
            return { kind: 'too_large' };
          }
          chunks.push(value);
        }
      }
    } catch {
      return { kind: 'invalid' };
    }
    const merged = new Uint8Array(received);
    let offset = 0;
    for (const chunk of chunks) {
      merged.set(chunk, offset);
      offset += chunk.byteLength;
    }
    text = new TextDecoder('utf-8').decode(merged);
  }

  if (!text.trim()) {
    return { kind: 'invalid' };
  }
  try {
    return { kind: 'ok', data: JSON.parse(text) };
  } catch {
    return { kind: 'invalid' };
  }
}
