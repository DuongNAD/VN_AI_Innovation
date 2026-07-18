import { prisma } from '@/lib/db';
import { AppError, handleRoute, jsonOk } from '@/lib/errors';
import { createLoginSession, publicUser } from '@/lib/login-auth';
import { enforceRateLimit } from '@/lib/rate-limit';


export const GET = handleRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  enforceRateLimit('auth-vnid', req, { limit: 60, windowMs: 60000 });
  const { id } = await params;

  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    throw new AppError(400, 'INVALID_INPUT', 'Mã phiên VNeID không hợp lệ.');
  }

  const challenge = await prisma.vnidChallenge.findUnique({ where: { id } });
  if (!challenge) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy phiên quét VNeID.');
  }

  if (challenge.status === 'PENDING' && challenge.expiresAt.getTime() < Date.now()) {
    await prisma.vnidChallenge.update({
      where: { id },
      data: { status: 'EXPIRED' },
    });
    return jsonOk({ status: 'EXPIRED', user: null });
  }

  if (challenge.status === 'CONFIRMED' && challenge.userId) {
    const user = await prisma.user.findUnique({ where: { id: challenge.userId } });
    if (!user) {
      return jsonOk({ status: 'CONFIRMED', user: null });
    }

    // Issue browser session once status is confirmed
    const session = await createLoginSession(user.id, req);
    // Consume challenge so refresh doesn't re-issue forever
    await prisma.vnidChallenge.update({
      where: { id },
      data: { status: 'CONSUMED' },
    });

    return jsonOk(
      {
        status: 'CONFIRMED',
        user: publicUser(user),
        expiresAt: session.expiresAt.toISOString(),
      },
      {
        headers: {
          'Set-Cookie': session.cookie,
        },
      }
    );
  }

  return jsonOk({
    status: challenge.status,
    user: null,
  });
});
