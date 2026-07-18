import crypto from 'crypto';
import { AppError } from './errors';
import { getAdminToken, getManagerToken } from './config';
import { rateLimitCheck, rateLimitConsume } from './rate-limit';
import { staffSatisfies, type StaffRole } from './roles';

/**
 * Computes the SHA-256 hash of the input as a hex string.
 */
export function sha256hex(input: string | Buffer): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Generates a 256-bit secure random access token returned as a base64url string.
 */
export function generateAccessToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Hashes a session token with a static prefix to prevent leakage.
 */
export function hashToken(token: string): string {
  return sha256hex('psp-session:' + token);
}

/**
 * Verifies a token against a stored hash using constant-time comparison.
 */
export function verifyToken(token: string, storedHash: string): boolean {
  try {
    const computedHash = hashToken(token);
    const bufA = Buffer.from(computedHash, 'utf8');
    const bufB = Buffer.from(storedHash, 'utf8');
    if (bufA.length !== 64 || bufB.length !== 64) {
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch (e) {
    return false;
  }
}

/**
 * Validates the X-Session-Token header. Throws a 403 Forbidden AppError on failure.
 */
export function requireSessionToken(req: Request, storedHash: string, expiresAt?: Date): void {
  const token = req.headers.get('x-session-token');
  if (!token || token.trim() === '' || token.length > 200 || !verifyToken(token, storedHash)) {
    throw new AppError(403, 'FORBIDDEN', 'Không có quyền truy cập phiên này.');
  }
  if (expiresAt && expiresAt.getTime() < Date.now()) {
    throw new AppError(403, 'FORBIDDEN', 'Không có quyền truy cập phiên này.');
  }
}

function tokenMatchesSecret(presented: string, secret: string): boolean {
  const presentedHash = crypto.createHash('sha256').update(presented).digest();
  const secretHash = crypto.createHash('sha256').update(secret).digest();
  return crypto.timingSafeEqual(presentedHash, secretHash);
}

/**
 * Resolve staff role from request headers.
 * - X-Admin-Token  → admin (if matches ADMIN_TOKEN)
 * - X-Manager-Token → manager (if matches MANAGER_TOKEN)
 * Admin takes precedence when both headers are present and valid.
 * Returns null when neither credential is valid (does not throw / rate-limit).
 */
export function resolveStaffRole(req: Request): StaffRole | null {
  const adminPresented = req.headers.get('x-admin-token') ?? '';
  const managerPresented = req.headers.get('x-manager-token') ?? '';

  try {
    if (adminPresented !== '' && tokenMatchesSecret(adminPresented, getAdminToken())) {
      return 'admin';
    }
  } catch {
    // Config invalid — treated as non-match at request time; startup already validates.
  }

  try {
    if (managerPresented !== '' && tokenMatchesSecret(managerPresented, getManagerToken())) {
      return 'manager';
    }
  } catch {
    // same as above
  }

  return null;
}

/**
 * Validates legacy shared staff tokens only (X-Admin-Token / X-Manager-Token).
 * Prefer requireStaffAuth from login-auth.ts for cookie + token.
 */
export function requireStaff(req: Request, minRole: StaffRole = 'manager'): StaffRole {
  rateLimitCheck('staff-auth', req, 5, 900000);

  const role = resolveStaffRole(req);

  if (role === null) {
    rateLimitConsume('staff-auth', req);
    throw new AppError(401, 'UNAUTHORIZED', 'Sai mã xác thực. Vui lòng kiểm tra lại.');
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

  return role;
}

/**
 * @deprecated Prefer async requireStaffAuth — kept for sync call sites that only use shared tokens.
 */
export function requireAdmin(req: Request): void {
  requireStaff(req, 'admin');
}

/**
 * @deprecated Prefer async requireStaffAuth
 */
export function requireManagerOrAdmin(req: Request): StaffRole {
  return requireStaff(req, 'manager');
}
