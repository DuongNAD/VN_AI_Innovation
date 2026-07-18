export type LoginPortal = 'user' | 'manager' | 'admin';

export function portalHome(portal: LoginPortal): string {
  if (portal === 'user') return '/user';
  if (portal === 'manager') return '/manager';
  return '/admin';
}

export function portalAccent(portal: LoginPortal): string {
  if (portal === 'admin') return 'from-amber-600 to-orange-500';
  if (portal === 'manager') return 'from-sky-600 to-indigo-500';
  return 'from-brand-600 to-sky-500';
}

/**
 * Only allow same-portal relative paths (blocks open redirect).
 * Reads ?next= from the current location (client-only).
 */
export function safeReturnPath(portal: LoginPortal): string | null {
  if (typeof window === 'undefined') return null;
  const raw = new URLSearchParams(window.location.search).get('next');
  if (!raw || !raw.startsWith('/') || raw.startsWith('//')) return null;
  const pathOnly = raw.split('?')[0] || '';
  const prefix = portalHome(portal);
  if (pathOnly === prefix || pathOnly.startsWith(prefix + '/')) {
    return raw;
  }
  return null;
}
