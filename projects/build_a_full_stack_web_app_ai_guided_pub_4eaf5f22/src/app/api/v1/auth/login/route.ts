import { isDbConnectivityError, prisma, withDbRetry } from '@/lib/db';
import { AppError, handleRoute, jsonOk } from '@/lib/errors';
import { readJsonBody, requireString } from '@/lib/http';
import { createLoginSession, publicUser } from '@/lib/login-auth';
import { verifyPassword } from '@/lib/password';
import type { AppRole } from '@/lib/roles';
import { enforceRateLimit, rateLimitCheck, rateLimitConsume } from '@/lib/rate-limit';

/** Mỗi cổng chỉ chấp nhận đúng 1 role — manager không vào admin, admin không vào manager. */
const PORTAL_ROLE: Record<string, AppRole> = {
  user: 'user',
  manager: 'manager',
  admin: 'admin',
};

const GENERIC_AUTH_ERROR = 'Tài khoản hoặc mật khẩu không đúng.';

export const POST = handleRoute(async (req: Request) => {
  enforceRateLimit('auth-login', req, { limit: 20, windowMs: 60000 });
  rateLimitCheck('auth-login-fail', req, 10, 900000);

  const body = await readJsonBody(req);
  const usernameOrEmail = requireString(body, 'username', 120).trim().toLowerCase();
  const password = requireString(body, 'password', 128);
  const portalRaw = typeof body.portal === 'string' ? body.portal.trim().toLowerCase() : 'user';
  const requiredRole = PORTAL_ROLE[portalRaw];
  if (!requiredRole) {
    throw new AppError(400, 'INVALID_INPUT', 'Cổng đăng nhập không hợp lệ.', { field: 'portal' });
  }

  let user;
  try {
    user = await withDbRetry(
      () =>
        prisma.user.findFirst({
          where: {
            OR: [{ username: usernameOrEmail }, { email: usernameOrEmail }],
          },
        }),
      { retries: 3, delayMs: 400, label: 'auth-login-findUser' }
    );
  } catch (err) {
    console.error('[auth/login] database unreachable:', err);
    throw new AppError(
      503,
      'SERVICE_UNAVAILABLE',
      isDbConnectivityError(err)
        ? 'Không kết nối được cơ sở dữ liệu. Hãy chạy Docker (postgres) rồi thử lại: docker compose up -d db'
        : 'Không kết nối được cơ sở dữ liệu. Vui lòng thử lại sau.'
    );
  }

  if (!user || !user.passwordHash) {
    rateLimitConsume('auth-login-fail', req);
    throw new AppError(401, 'UNAUTHORIZED', GENERIC_AUTH_ERROR);
  }

  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    rateLimitConsume('auth-login-fail', req);
    throw new AppError(401, 'UNAUTHORIZED', GENERIC_AUTH_ERROR);
  }

  // Strict 1:1 portal ↔ role (manager never becomes admin session via /admin/login).
  // Anti-enumeration: a wrong-portal attempt answers EXACTLY like wrong
  // credentials — never confirm the account exists, that the password was
  // right, or which portal it belongs to.
  if (user.role !== requiredRole) {
    rateLimitConsume('auth-login-fail', req);
    throw new AppError(401, 'UNAUTHORIZED', GENERIC_AUTH_ERROR);
  }

  let session;
  try {
    session = await withDbRetry(() => createLoginSession(user.id, req), {
      retries: 3,
      delayMs: 400,
      label: 'auth-login-session',
    });
  } catch (err) {
    console.error('[auth/login] createLoginSession failed:', err);
    throw new AppError(
      503,
      'SERVICE_UNAVAILABLE',
      'Không tạo được phiên đăng nhập (lỗi cơ sở dữ liệu). Kiểm tra PostgreSQL đang chạy: docker compose up -d db'
    );
  }
  const pub = publicUser(user);

  return jsonOk(
    {
      user: pub,
      expiresAt: session.expiresAt.toISOString(),
    },
    {
      headers: {
        'Set-Cookie': session.cookie,
      },
    }
  );
});
