import crypto from 'crypto';
import { cookies } from 'next/headers';
import { prisma } from './db';
import { AppError } from './errors';
import { generateAccessToken, hashToken, sha256hex } from './auth';
import { isProd } from './config';
import { staffSatisfies, type AppRole, type StaffRole } from './roles';
import { getClientIp } from './http';

export const LOGIN_COOKIE = 'psp_login';
export const LOGIN_TTL_HOURS = 24;

export type AuthUser = {
  id: string;
  username: string;
  email: string | null;
  displayName: string;
  phone: string | null;
  dateOfBirth: string | null;
  address: string | null;
  citizenId: string | null;
  gender: string | null;
  placeOfBirth: string | null;
  idIssuedAt: string | null;
  idExpiresAt: string | null;
  role: AppRole;
  avatarUrl: string | null;
};

function isAppRole(v: string): v is AppRole {
  return v === 'user' || v === 'manager' || v === 'admin';
}

export function publicUser(u: {
  id: string;
  username: string;
  email: string | null;
  displayName: string;
  phone: string | null;
  dateOfBirth: Date | null;
  address: string | null;
  citizenId: string | null;
  gender: string | null;
  placeOfBirth: string | null;
  idIssuedAt: Date | null;
  idExpiresAt: Date | null;
  role: string;
  avatarUrl: string | null;
}): AuthUser {
  if (!isAppRole(u.role)) {
    throw new AppError(500, 'DATA_INTEGRITY', 'Vai trò người dùng không hợp lệ.');
  }
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    displayName: u.displayName,
    phone: u.phone,
    dateOfBirth: u.dateOfBirth ? u.dateOfBirth.toISOString().slice(0, 10) : null,
    address: u.address,
    citizenId: u.citizenId,
    gender: u.gender,
    placeOfBirth: u.placeOfBirth,
    idIssuedAt: u.idIssuedAt ? u.idIssuedAt.toISOString().slice(0, 10) : null,
    idExpiresAt: u.idExpiresAt ? u.idExpiresAt.toISOString().slice(0, 10) : null,
    role: u.role,
    avatarUrl: u.avatarUrl,
  };
}

export function buildLoginCookie(token: string, maxAgeSeconds: number): string {
  const parts = [
    `${LOGIN_COOKIE}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (isProd()) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function buildClearLoginCookie(): string {
  const parts = [`${LOGIN_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (isProd()) parts.push('Secure');
  return parts.join('; ');
}

function parseCookieHeader(header: string | null): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx <= 0) continue;
    const k = part.slice(0, idx).trim();
    const v = part.slice(idx + 1).trim();
    if (k) out[k] = decodeURIComponent(v);
  }
  return out;
}

export function getLoginTokenFromRequest(req: Request): string | null {
  // Prefer Authorization: Bearer <token> for API clients; cookie for browsers
  const auth = req.headers.get('authorization');
  if (auth && auth.toLowerCase().startsWith('bearer ')) {
    const t = auth.slice(7).trim();
    if (t.length > 0 && t.length <= 200) return t;
  }
  const cookiesMap = parseCookieHeader(req.headers.get('cookie'));
  const fromCookie = cookiesMap[LOGIN_COOKIE];
  if (fromCookie && fromCookie.length > 0 && fromCookie.length <= 200) return fromCookie;
  return null;
}

export async function createLoginSession(
  userId: string,
  req?: Request
): Promise<{ token: string; expiresAt: Date; cookie: string }> {
  const token = generateAccessToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + LOGIN_TTL_HOURS * 3600 * 1000);
  const userAgent = req?.headers.get('user-agent')?.slice(0, 300) ?? null;
  const ipHint = req ? getClientIp(req).slice(0, 64) : null;

  await prisma.loginSession.create({
    data: {
      userId,
      tokenHash,
      expiresAt,
      userAgent,
      ipHint,
    },
  });

  return {
    token,
    expiresAt,
    cookie: buildLoginCookie(token, LOGIN_TTL_HOURS * 3600),
  };
}

export async function revokeLoginSessionByToken(token: string | null): Promise<void> {
  if (!token) return;
  const tokenHash = hashToken(token);
  await prisma.loginSession.deleteMany({ where: { tokenHash } });
}

export async function getAuthUserFromToken(token: string | null): Promise<AuthUser | null> {
  if (!token) return null;
  const { isDbConnectivityError, withDbRetry } = await import('./db');
  try {
    return await withDbRetry(async () => {
      const tokenHash = hashToken(token);
      const session = await prisma.loginSession.findUnique({
        where: { tokenHash },
        include: { user: true },
      });
      if (!session) return null;
      if (session.expiresAt.getTime() < Date.now()) {
        await prisma.loginSession.deleteMany({ where: { id: session.id } }).catch(() => undefined);
        return null;
      }
      return publicUser(session.user);
    }, { retries: 3, delayMs: 350, label: 'getAuthUserFromToken' });
  } catch (err) {
    // Propagate connectivity errors so AuthGate can keep the cookie/session
    // instead of bouncing the user to login.
    if (isDbConnectivityError(err)) {
      throw err;
    }
    console.error('[auth] getAuthUserFromToken failed:', err);
    return null;
  }
}

export async function getAuthUserFromRequest(req: Request): Promise<AuthUser | null> {
  return getAuthUserFromToken(getLoginTokenFromRequest(req));
}

/**
 * Server Component helper — reads the login cookie via next/headers.
 * Soft-fails to null on DB connectivity issues (optional chrome such as chat).
 * AuthGate uses getAuthUserFromToken directly so it can show a reconnect UI.
 */
export async function getAuthUserFromCookies(): Promise<AuthUser | null> {
  const jar = await cookies();
  const token = jar.get(LOGIN_COOKIE)?.value ?? null;
  try {
    return await getAuthUserFromToken(token);
  } catch (err) {
    const { isDbConnectivityError } = await import('./db');
    if (isDbConnectivityError(err)) {
      console.error('[auth] getAuthUserFromCookies: database temporarily unavailable');
      return null;
    }
    throw err;
  }
}

export async function requireAuthUser(
  req: Request,
  allowed: AppRole[] | 'any' = 'any'
): Promise<AuthUser> {
  const user = await getAuthUserFromRequest(req);
  if (!user) {
    throw new AppError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập để tiếp tục.');
  }
  if (allowed !== 'any' && !allowed.includes(user.role)) {
    throw new AppError(403, 'FORBIDDEN', 'Bạn không có quyền truy cập tài nguyên này.');
  }
  return user;
}

/**
 * Staff API auth: cookie login session (manager/admin) OR legacy shared tokens.
 */
export async function resolveStaffFromRequest(req: Request): Promise<StaffRole | null> {
  const user = await getAuthUserFromRequest(req);
  if (user?.role === 'admin' || user?.role === 'manager') {
    return user.role;
  }
  // Legacy shared tokens (still supported for automation / demos)
  const { resolveStaffRole } = await import('./auth');
  return resolveStaffRole(req);
}

export async function requireStaffAuth(
  req: Request,
  minRole: StaffRole = 'manager'
): Promise<{ role: StaffRole; user: AuthUser | null }> {
  const { rateLimitCheck, rateLimitConsume } = await import('./rate-limit');
  rateLimitCheck('staff-auth', req, 5, 900000);

  const role = await resolveStaffFromRequest(req);
  if (role === null) {
    rateLimitConsume('staff-auth', req);
    throw new AppError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập hoặc cung cấp mã xác thực.');
  }
  if (!staffSatisfies(role, minRole)) {
    throw new AppError(
      403,
      'FORBIDDEN',
      minRole === 'admin'
        ? 'Chỉ quản trị viên mới được thực hiện thao tác này.'
        : 'Bạn không có quyền truy cập tài nguyên này.'
    );
  }

  const user = await getAuthUserFromRequest(req);
  return { role, user };
}

export function hashLoginToken(token: string): string {
  return hashToken(token);
}

export function randomNonce(): string {
  return crypto.randomBytes(16).toString('base64url');
}

export function oauthStateToken(portal: string, provider: string): string {
  const payload = JSON.stringify({
    portal,
    provider,
    n: crypto.randomBytes(8).toString('hex'),
    t: Date.now(),
  });
  return Buffer.from(payload).toString('base64url');
}

export function parseOAuthState(state: string): { portal: string; provider: string } | null {
  try {
    const raw = Buffer.from(state, 'base64url').toString('utf8');
    const obj = JSON.parse(raw) as { portal?: string; provider?: string; t?: number };
    if (!obj.portal || !obj.provider) return null;
    if (typeof obj.t === 'number' && Date.now() - obj.t > 15 * 60 * 1000) return null;
    return { portal: obj.portal, provider: obj.provider };
  } catch {
    return null;
  }
}

export function fingerprintEmail(provider: string, sub: string): string {
  return `${provider}_${sha256hex(sub).slice(0, 12)}@oauth.local`;
}
