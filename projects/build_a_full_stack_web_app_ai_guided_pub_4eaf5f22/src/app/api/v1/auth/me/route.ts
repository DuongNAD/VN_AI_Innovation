import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { AppError, handleRoute, jsonOk } from '@/lib/errors';
import { readJsonBody } from '@/lib/http';
import { getAuthUserFromRequest, publicUser, requireAuthUser } from '@/lib/login-auth';
import { parseProfileUpdate } from '@/lib/profile';

export const GET = handleRoute(async (req: Request) => {
  const user = await getAuthUserFromRequest(req);
  return jsonOk({
    authenticated: !!user,
    user,
  });
});

export const PATCH = handleRoute(async (req: Request) => {
  const actor = await requireAuthUser(req, ['user']);
  const body = await readJsonBody(req);
  const profile = parseProfileUpdate(body);

  try {
    const updated = await prisma.user.update({
      where: { id: actor.id },
      data: profile,
    });
    return jsonOk({ user: publicUser(updated), message: 'Đã lưu thông tin cá nhân.' });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const target = Array.isArray(error.meta?.target)
        ? error.meta.target.map(String)
        : [String(error.meta?.target ?? '')];
      if (target.some((field) => field.includes('citizenId'))) {
        throw new AppError(
          409,
          'CITIZEN_ID_IN_USE',
          'Số định danh này đã được liên kết với tài khoản khác.',
          { field: 'citizenId' }
        );
      }
      throw new AppError(
        409,
        'EMAIL_IN_USE',
        'Email này đã được sử dụng bởi tài khoản khác.',
        { field: 'email' }
      );
    }
    throw error;
  }
});
