import { prisma } from '@/lib/db';
import { handleRoute, jsonOk } from '@/lib/errors';
import { randomNonce } from '@/lib/login-auth';
import { enforceRateLimit } from '@/lib/rate-limit';

const VNID_TTL_MS = 5 * 60 * 1000;

/**
 * Start a VNeID QR login challenge.
 * Client displays qrPayload as QR; phone app (or demo confirm) completes it.
 */
export const POST = handleRoute(async (req: Request) => {
  enforceRateLimit('auth-vnid', req, { limit: 20, windowMs: 60000 });

  const nonce = randomNonce();
  const expiresAt = new Date(Date.now() + VNID_TTL_MS);
  const origin = new URL(req.url).origin;

  const challenge = await prisma.vnidChallenge.create({
    data: {
      nonce,
      status: 'PENDING',
      expiresAt,
    },
  });

  // Payload a VNeID-compatible app would scan (demo format)
  const qrPayload = JSON.stringify({
    v: 1,
    type: 'vnid-login',
    challengeId: challenge.id,
    nonce,
    callback: `${origin}/api/v1/auth/vnid/${challenge.id}/confirm`,
    exp: expiresAt.toISOString(),
  });

  return jsonOk({
    challengeId: challenge.id,
    nonce,
    expiresAt: expiresAt.toISOString(),
    qrPayload,
    pollUrl: `/api/v1/auth/vnid/${challenge.id}/status`,
    demo: true,
  });
});
