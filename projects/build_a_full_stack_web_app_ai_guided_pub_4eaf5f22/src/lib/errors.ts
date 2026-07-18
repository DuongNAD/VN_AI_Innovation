export class AppError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

function jsonHeaders(overrides?: Record<string, string>): Headers {
  const headers = new Headers({
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store, private',
    'Pragma': 'no-cache',
  });

  if (overrides) {
    for (const [name, value] of Object.entries(overrides)) {
      headers.set(name, value);
    }
  }

  return headers;
}

export function jsonOk(
  body: unknown,
  init?: { status?: number; headers?: Record<string, string> }
): Response {
  return new Response(JSON.stringify(body), {
    status: init?.status ?? 200,
    headers: jsonHeaders(init?.headers),
  });
}

export function handleRoute<C>(
  fn: (req: Request, ctx: C) => Promise<Response>
): (req: Request, ctx: C) => Promise<Response> {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      if (err instanceof AppError) {
        const errorBody = {
          error: {
            code: err.code,
            message: err.message,
            details: err.details,
          },
        };
        const headers = jsonHeaders();

        if (
          err.details &&
          typeof err.details === 'object' &&
          err.details !== null &&
          'retryAfterSeconds' in err.details
        ) {
          const retryAfter = (err.details as any).retryAfterSeconds;
          if (typeof retryAfter === 'number') {
            headers.set('Retry-After', String(retryAfter));
          }
        }

        return new Response(JSON.stringify(errorBody), {
          status: err.status,
          headers,
        });
      }

      console.error(err);
      const errorBody = {
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.',
        },
      };
      return new Response(JSON.stringify(errorBody), {
        status: 500,
        headers: jsonHeaders(),
      });
    }
  };
}
