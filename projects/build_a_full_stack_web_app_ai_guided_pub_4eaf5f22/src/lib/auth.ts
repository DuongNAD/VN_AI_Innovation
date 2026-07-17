import crypto from 'crypto';
import { AppError } from './errors';
import { getAdminToken } from './config';
import { rateLimitCheck, rateLimitConsume } from './rate-limit';

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

/**
 * Validates the X-Admin-Token header. Enforces rate limits on failures.
 * Throws a 401 Unauthorized AppError on failure, or 429 when rate-limited.
 */
export function requireAdmin(req: Request): void {
  const presented = req.headers.get('x-admin-token') ?? '';

  // Check rate limit budget first (throws 429 when budget spent)
  rateLimitCheck('admin-auth', req, 5, 900000);

  const presentedHash = crypto.createHash('sha256').update(presented).digest();
  const adminTokenHash = crypto.createHash('sha256').update(getAdminToken()).digest();

  if (!crypto.timingSafeEqual(presentedHash, adminTokenHash)) {
    rateLimitConsume('admin-auth', req);
    throw new AppError(401, 'UNAUTHORIZED', 'Sai mã quản trị.');
  }
}