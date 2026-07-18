import type { AppRole } from '@/lib/roles';

export const USERNAME_RE = /^[a-z0-9._]{3,50}$/;
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isAppRole(v: unknown): v is AppRole {
  return v === 'user' || v === 'manager' || v === 'admin';
}

/** Account row for the admin console — never exposes the hash itself. */
export function accountDto(u: {
  id: string;
  username: string;
  displayName: string;
  email: string | null;
  role: string;
  createdAt: Date;
  passwordHash: string | null;
}) {
  return {
    id: u.id,
    username: u.username,
    displayName: u.displayName,
    email: u.email,
    role: u.role,
    createdAt: u.createdAt.toISOString(),
    hasPassword: u.passwordHash !== null,
  };
}
