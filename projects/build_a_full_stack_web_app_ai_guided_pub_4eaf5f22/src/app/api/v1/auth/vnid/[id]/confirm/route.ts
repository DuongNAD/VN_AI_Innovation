import { createHash } from 'crypto';
import { prisma } from '@/lib/db';
import { AppError, handleRoute, jsonOk } from '@/lib/errors';
import { readJsonBody } from '@/lib/http';
import { enforceRateLimit } from '@/lib/rate-limit';

/**
 * Confirm a VNeID QR challenge.
 * In production this is called by the VNeID backend after the citizen approves on their phone.
 * In demo mode the login page calls this to simulate a successful scan.
 */
export const POST = handleRoute(async (req: Request, { params }: { params: Promise<{ id: string }> }) => {
  enforceRateLimit('auth-vnid', req, { limit: 30, windowMs: 60000 });
  const { id } = await params;

  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id)) {
    throw new AppError(400, 'INVALID_INPUT', 'Mã phiên VNeID không hợp lệ.');
  }

  let body: Record<string, unknown> = {};
  try {
    body = await readJsonBody(req);
  } catch {
    body = {};
  }

  const challenge = await prisma.vnidChallenge.findUnique({ where: { id } });
  if (!challenge) {
    throw new AppError(404, 'NOT_FOUND', 'Không tìm thấy phiên quét VNeID.');
  }
  if (challenge.expiresAt.getTime() < Date.now()) {
    await prisma.vnidChallenge.update({ where: { id }, data: { status: 'EXPIRED' } });
    throw new AppError(410, 'EXPIRED', 'Mã QR VNeID đã hết hạn. Vui lòng tạo mã mới.');
  }
  if (challenge.status !== 'PENDING') {
    throw new AppError(409, 'ALREADY_PROCESSED', 'Phiên VNeID đã được xử lý.');
  }

  const demo = body.demo === true || body.demo === '1' || process.env.VNID_DEMO !== '0';
  if (!demo) {
    throw new AppError(
      501,
      'VNID_NOT_CONFIGURED',
      'Xác nhận VNeID thật chưa được cấu hình trên máy chủ demo.'
    );
  }

  // KHÔNG nhận citizenId/fullName từ client: endpoint này không xác thực,
  // nếu tin body thì bất kỳ ai cũng đăng nhập được vào tài khoản vnid_<số>
  // của người khác. Danh tính demo sinh từ chính challenge — mỗi lượt quét
  // một tài khoản riêng, xác nhận lặp lại vẫn ra cùng tài khoản.
  const digest = createHash('sha256').update(`vnid-demo:${id}`).digest('hex');
  const citizenId = String(BigInt('0x' + digest.slice(0, 12)) % 1000000000000n).padStart(12, '0');
  const fullName = 'Công dân VNeID (demo)';

  const username = `vnid_${citizenId}`;
  const email = `vnid.${citizenId}@vnid.local`;

  const user = await prisma.user.upsert({
    where: { username },
    update: {
      displayName: fullName,
      role: 'user',
    },
    create: {
      username,
      email,
      displayName: fullName,
      passwordHash: null,
      role: 'user',
    },
  });

  await prisma.vnidChallenge.update({
    where: { id },
    data: {
      status: 'CONFIRMED',
      userId: user.id,
    },
  });

  return jsonOk({
    ok: true,
    status: 'CONFIRMED',
    challengeId: id,
  });
});
