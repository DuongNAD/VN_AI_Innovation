import type { Flow, Question } from './chat-types';

/** Normalize intake API question shape → local Question */
export function toQuestion(raw: any): Question | null {
  if (!raw) return null;
  return {
    questionCode: raw.questionCode ?? raw.code ?? '',
    label: raw.label ?? raw.questionText ?? '',
    fieldType: raw.fieldType,
    options: raw.options ?? undefined,
  };
}

export function toFlow(data: any): Flow {
  if (data.flow) {
    return {
      next: toQuestion(data.flow.next),
      answered: data.flow.answered || 0,
      total: data.flow.total || 0,
    };
  }
  return {
    next: toQuestion(data.question),
    answered: data.progress?.answered || 0,
    total: data.progress?.total || 0,
  };
}

export const randomUUID = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};

export function safeHttpsUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') {
    return null;
  }
  try {
    const url = new URL(raw);
    if (url.protocol === 'https:') {
      return url.href;
    }
  } catch {
    // ignore
  }
  return null;
}

export async function chatApi<T>(
  path: string,
  opts?: { method?: string; body?: unknown; form?: FormData; token?: string }
): Promise<{ ok: true; data: T; status: number } | { ok: false; message: string; status: number }> {
  try {
    const headers: Record<string, string> = {};
    if (opts?.token && opts.token.trim() !== '') {
      headers['X-Session-Token'] = opts.token;
    }

    let requestBody: any = undefined;
    if (opts?.form) {
      requestBody = opts.form;
    } else if (opts?.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      requestBody = JSON.stringify(opts.body);
    }

    const res = await fetch(path, {
      method: opts?.method || 'POST',
      headers,
      body: requestBody,
    });

    if (res.ok) {
      try {
        const data = await res.json();
        return { ok: true, data: data as T, status: res.status };
      } catch {
        return { ok: false, message: 'Dữ liệu phản hồi không hợp lệ.', status: res.status };
      }
    }

    let message = 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.';
    if (res.status === 429) {
      message = 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.';
    } else {
      try {
        const body = await res.json();
        if (body && body.error && typeof body.error.message === 'string') {
          message = body.error.message;
        } else if (body && typeof body.message === 'string') {
          message = body.message;
        }
      } catch {
        // Ignored
      }
    }
    return { ok: false, message, status: res.status };
  } catch {
    return {
      ok: false,
      message: 'Đã xảy ra lỗi hệ thống. Vui lòng thử lại sau.',
      status: 0,
    };
  }
}
