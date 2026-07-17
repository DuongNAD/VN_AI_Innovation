'use client';

// Client-side session helper. The guided-intake session id and its bearer
// token live in sessionStorage (tab-scoped, cleared on tab close) under a
// single key, so personal data never persists across browser sessions.
const SESSION_KEY = 'psp_session';

interface StoredSession {
  sessionId: string;
  token: string;
}

function read(): StoredSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed.sessionId === 'string' &&
      typeof parsed.token === 'string'
    ) {
      return { sessionId: parsed.sessionId, token: parsed.token };
    }
    return null;
  } catch (_) {
    return null;
  }
}

export function getSessionId(): string | null {
  return read()?.sessionId ?? null;
}

export function getToken(): string | null {
  return read()?.token ?? null;
}

export function setSession(sessionId: string, token: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      SESSION_KEY,
      JSON.stringify({ sessionId, token }),
    );
  } catch (_) {
    // Storage may be unavailable (private mode / quota); non-fatal.
  }
}

export function clearSession(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(SESSION_KEY);
  } catch (_) {
    // Non-fatal.
  }
}
