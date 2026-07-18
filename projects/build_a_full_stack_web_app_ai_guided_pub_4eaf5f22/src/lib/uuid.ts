// crypto.randomUUID is only defined in secure contexts (https / localhost).
// Judged demos may run over plain http on a LAN IP, so fall back to a
// Math.random-based v4 UUID — these ids are idempotency keys, not secrets.
export function randomUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
