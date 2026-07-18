import { prisma } from '@/lib/db';
import { AppError, handleRoute, jsonOk } from '@/lib/errors';
import { optionalString, readJsonBody, requireString } from '@/lib/http';
import { requireStaffAuth } from '@/lib/login-auth';
import { hashPassword, isStrongEnoughPassword } from '@/lib/password';
import { accountDto, EMAIL_RE, isAppRole, USERNAME_RE } from './shared';

/** GET — account list. Managing accounts is the admin's exclusive duty. */
export const GET = handleRoute(async (req: Request) => {
  await requireStaffAuth(req, 'admin');

  const rows = await prisma.user.findMany({
    // Alphabetical role sort conveniently surfaces staff first: admin < manager < user.
    orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    take: 200,
  });

  return jsonOk({ users: rows.map(accountDto) });
});

/**
 * POST — create an account. Staff accounts (manager/admin) can ONLY be born
 * here: public self-registration is citizen-only.
 */
export const POST = handleRoute(async (req: Request) => {
  await requireStaffAuth(req, 'admin');

  const body = await readJsonBody(req);
  const username = requireString(body, 'username', 50).toLowerCase();
  const displayName = requireString(body, 'displayName', 100);
  const password = requireString(body, 'password', 128);
  const emailRaw = optionalString(body, 'email', 200);
  const role = requireString(body, 'role', 20);

  if (!USERNAME_RE.test(username)) {
    throw new AppError(
      400,
      'INVALID_INPUT',
      'Tên tài khoản 3–50 ký tự, chỉ gồm a-z, 0-9, dấu chấm và gạch dưới.',
      { field: 'username' }
    );
  }
  if (!isAppRole(role)) {
    throw new AppError(400, 'INVALID_INPUT', 'Vai trò không hợp lệ.', { field: 'role' });
  }
  if (!isStrongEnoughPassword(password)) {
    throw new AppError(400, 'INVALID_INPUT', 'Mật khẩu tối thiểu 8 ký tự, phải có chữ và số.', {
      field: 'password',
    });
  }

  let email: string | null = null;
  if (emailRaw !== undefined) {
    const normalized = emailRaw.toLowerCase();
    if (!EMAIL_RE.test(normalized)) {
      throw new AppError(400, 'INVALID_INPUT', 'Email không hợp lệ.', { field: 'email' });
    }
    email = normalized;
  }

  const passwordHash = await hashPassword(password);

  try {
    const created = await prisma.user.create({
      data: { username, email, displayName, passwordHash, role },
    });
    return jsonOk({ user: accountDto(created) });
  } catch (err: unknown) {
    const code = err && typeof err === 'object' && 'code' in err ? (err as { code?: string }).code : undefined;
    if (code === 'P2002') {
      throw new AppError(409, 'CONFLICT', 'Tên tài khoản hoặc email đã được sử dụng.');
    }
    throw err;
  }
});
