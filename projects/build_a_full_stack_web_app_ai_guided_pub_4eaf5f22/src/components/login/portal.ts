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
