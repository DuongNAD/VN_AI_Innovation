import { prisma } from '@/lib/db';
import { AppError, handleRoute, jsonOk } from '@/lib/errors';
import { optionalString, readJsonBody, requireString } from '@/lib/http';
import { createLoginSession, publicUser } from '@/lib/login-auth';
import { hashPassword, isStrongEnoughPassword } from '@/lib/password';
import type { AppRole } from '@/lib/roles';
import { enforceRateLimit } from '@/lib/rate-limit';

// Public self-registration is citizen-only. Staff accounts (manager/admin)
// are issued by an admin in the account-management console, never self-made.
const PORTAL_ROLE: Record<string, AppRole> = {
  user: 'user',
};

const USERNAME_RE = /^[a-z0-9._]{3,50}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const POST = handleRoute(async (req: Request) => {
  enforceRateLimit('auth-register', req, { limit: 5, windowMs: 60000 });

  const body = await readJsonBody(req);

  const usernameRaw = requireString(body, 'username', 50).toLowerCase();
  const password = requireString(body, 'password', 128);
  const displayName = requireString(body, 'displayName', 100);
  const emailRaw = optionalString(body, 'email', 200);
  const portalRaw = typeof body.portal === 'string' ? body.portal.trim().toLowerCase() : 'user';

  if (portalRaw === 'manager' || portalRaw === 'admin') {
    throw new AppError(
      403,
      'STAFF_REGISTRATION_CLOSED',
      'Tài khoản cán bộ do quản trị viên cấp trong mục Quản lý tài khoản, không thể tự đăng ký.'
    );
  }

  const role = PORTAL_ROLE[portalRaw];
  if (!role) {
    throw new AppError(400, 'INVALID_INPUT', 'Cổng đăng ký không hợp lệ.', { field: 'portal' });
  }

  if (!USERNAME_RE.test(usernameRaw)) {
    throw new AppError(
      400,
      'INVALID_INPUT',
      'Tên tài khoản 3–50 ký tự, chỉ gồm a-z, 0-9, dấu chấm và gạch dưới.',
      { field: 'username' }
    );
  }

  if (displayName.length < 1 || displayName.length > 100) {
    throw new AppError(400, 'INVALID_INPUT', 'Họ và tên không hợp lệ.', { field: 'displayName' });
  }

  if (!isStrongEnoughPassword(password)) {
    throw new AppError(
      400,
      'INVALID_INPUT',
      'Mật khẩu tối thiểu 8 ký tự, phải có chữ và số.',
      { field: 'password' }
    );
  }

  let email: string | null = null;
  if (emailRaw !== undefined) {
    const normalized = emailRaw.toLowerCase();
    if (!EMAIL_RE.test(normalized) || normalized.length > 200) {
      throw new AppError(400, 'INVALID_INPUT', 'Email không hợp lệ.', { field: 'email' });
    }
    email = normalized;
  }

  const existingUsername = await prisma.user.findUnique({ where: { username: usernameRaw } });
  if (existingUsername) {
    throw new AppError(409, 'CONFLICT', 'Tên tài khoản đã được sử dụng.');
  }

  if (email) {
    const existingEmail = await prisma.user.findUnique({ where: { email } });
    if (existingEmail) {
      throw new AppError(409, 'CONFLICT', 'Email đã được sử dụng.');
    }
  }

  const passwordHash = await hashPassword(password);

  let user;
  try {
    user = await prisma.user.create({
      data: {
        username: usernameRaw,
        email,
        displayName,
        passwordHash,
        role,
      },
    });
  } catch (err: unknown) {
    // Race on unique constraint
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined;
    if (code === 'P2002') {
      const target =
        err && typeof err === 'object' && 'meta' in err
          ? (err as { meta?: { target?: string[] } }).meta?.target
          : undefined;
      if (Array.isArray(target) && target.includes('email')) {
        throw new AppError(409, 'CONFLICT', 'Email đã được sử dụng.');
      }
      throw new AppError(409, 'CONFLICT', 'Tên tài khoản đã được sử dụng.');
    }
    throw err;
  }

  const session = await createLoginSession(user.id, req);
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
