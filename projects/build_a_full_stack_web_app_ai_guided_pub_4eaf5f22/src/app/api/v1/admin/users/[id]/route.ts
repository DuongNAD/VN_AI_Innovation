import { prisma } from '@/lib/db';
import { AppError, handleRoute, jsonOk } from '@/lib/errors';
import { optionalString, readJsonBody } from '@/lib/http';
import { requireStaffAuth } from '@/lib/login-auth';
import { hashPassword, isStrongEnoughPassword } from '@/lib/password';
import { accountDto, isAppRole } from '../shared';

/**
 * PATCH — admin updates an account: change role and/or reset password.
 * A password reset revokes every login session of that account; a role change
 * takes effect on the target's next request (role is read live per request).
 */
export const PATCH = handleRoute(
  async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
    const { user: actor } = await requireStaffAuth(req, 'admin');

    const { id } = await params;
    const body = await readJsonBody(req);
    const role = optionalString(body, 'role', 20);
    const password = optionalString(body, 'password', 128);

    if (role === undefined && password === undefined) {
      throw new AppError(400, 'INVALID_INPUT', 'Cần cung cấp vai trò mới hoặc mật khẩu mới.');
    }

    const target = await prisma.user.findUnique({ where: { id } });
    if (!target) {
      throw new AppError(404, 'USER_NOT_FOUND', 'Không tìm thấy tài khoản.');
    }

    const data: { role?: string; passwordHash?: string } = {};

    if (role !== undefined) {
      if (!isAppRole(role)) {
        throw new AppError(400, 'INVALID_INPUT', 'Vai trò không hợp lệ.', { field: 'role' });
      }
      // Self-demotion guard: the signed-in admin cannot change their own role,
      // so the system always keeps at least one admin. (The legacy shared-token
      // path has no identity and skips this check.)
      if (actor && actor.id === target.id) {
        throw new AppError(
          400,
          'SELF_ROLE_FORBIDDEN',
          'Không thể tự thay đổi vai trò của chính mình.'
        );
      }
      data.role = role;
    }

    if (password !== undefined) {
      if (!isStrongEnoughPassword(password)) {
        throw new AppError(400, 'INVALID_INPUT', 'Mật khẩu tối thiểu 8 ký tự, phải có chữ và số.', {
          field: 'password',
        });
      }
      data.passwordHash = await hashPassword(password);
    }

    const updated = await prisma.user.update({ where: { id: target.id }, data });

    if (data.passwordHash !== undefined) {
      await prisma.loginSession.deleteMany({ where: { userId: target.id } });
    }

    return jsonOk({ user: accountDto(updated) });
  }
);
