import { prisma } from '@/lib/db';
import { AppError, handleRoute, jsonOk } from '@/lib/errors';
import { readJsonBody, requireString } from '@/lib/http';
import {
  getLoginTokenFromRequest,
  hashLoginToken,
  requireAuthUser,
} from '@/lib/login-auth';
import { isDemoAccount } from '@/lib/demo-accounts';
import { hashPassword, isStrongEnoughPassword, verifyPassword } from '@/lib/password';
import { enforceRateLimit, rateLimitCheck, rateLimitConsume } from '@/lib/rate-limit';

// scrypt is a Node crypto primitive — pin the handler to the Node.js runtime.
export const runtime = 'nodejs';

/**
 * POST — the signed-in account changes its own password.
 *
 * Requires the current password (a hijacked session alone must not be able to
 * lock the owner out). On success the new password takes effect immediately and
 * every OTHER login session is revoked — other devices are logged out while the
 * device that made the change stays signed in.
 */
export const POST = handleRoute(async (req: Request) => {
  enforceRateLimit('auth-change-password', req, { limit: 10, windowMs: 60000 });
  // Separate 15-minute bucket so repeated wrong "current password" attempts are
  // throttled independently of legitimate throughput.
  rateLimitCheck('auth-change-password-fail', req, 10, 900000);

  const actor = await requireAuthUser(req, 'any');

  const body = await readJsonBody(req);
  const currentPassword = requireString(body, 'currentPassword', 128);
  const newPassword = requireString(body, 'newPassword', 128);

  const user = await prisma.user.findUnique({ where: { id: actor.id } });
  if (!user) {
    // Session pointed at a user that no longer exists.
    throw new AppError(401, 'UNAUTHORIZED', 'Vui lòng đăng nhập để tiếp tục.');
  }

  // Before any password verification so the lock is observable without ever
  // submitting a real credential pair.
  if (isDemoAccount(user.username)) {
    throw new AppError(
      403,
      'DEMO_ACCOUNT_PASSWORD_LOCKED',
      'Đây là tài khoản demo dùng chung cho ban giám khảo nên không thể đổi mật khẩu. Vui lòng đăng ký tài khoản riêng để sử dụng tính năng này.'
    );
  }

  if (!user.passwordHash) {
    throw new AppError(
      409,
      'PASSWORD_NOT_SET',
      'Tài khoản của bạn đăng nhập bằng mạng xã hội hoặc VNeID nên chưa có mật khẩu để đổi.'
    );
  }

  const currentOk = await verifyPassword(currentPassword, user.passwordHash);
  if (!currentOk) {
    rateLimitConsume('auth-change-password-fail', req);
    throw new AppError(401, 'INVALID_CURRENT_PASSWORD', 'Mật khẩu hiện tại không đúng.', {
      field: 'currentPassword',
    });
  }

  if (!isStrongEnoughPassword(newPassword)) {
    throw new AppError(
      400,
      'INVALID_INPUT',
      'Mật khẩu mới tối thiểu 8 ký tự, phải có chữ và số.',
      { field: 'newPassword' }
    );
  }

  if (newPassword === currentPassword) {
    throw new AppError(400, 'INVALID_INPUT', 'Mật khẩu mới phải khác mật khẩu hiện tại.', {
      field: 'newPassword',
    });
  }

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });

  // Revoke every other session; keep the current one so this device stays in.
  const currentToken = getLoginTokenFromRequest(req);
  const currentTokenHash = currentToken ? hashLoginToken(currentToken) : null;
  await prisma.loginSession.deleteMany({
    where: {
      userId: user.id,
      ...(currentTokenHash ? { tokenHash: { not: currentTokenHash } } : {}),
    },
  });

  return jsonOk({ message: 'Đã đổi mật khẩu. Các thiết bị khác đã được đăng xuất.' });
});
