import { prisma } from '@/lib/db';
import { AppError, handleRoute } from '@/lib/errors';
import { createLoginSession, fingerprintEmail, parseOAuthState } from '@/lib/login-auth';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PROVIDERS = new Set(['google', 'facebook']);

async function upsertOAuthUser(opts: {
  provider: string;
  providerUserId: string;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
}) {
  const existing = await prisma.oAuthAccount.findUnique({
    where: {
      provider_providerUserId: {
        provider: opts.provider,
        providerUserId: opts.providerUserId,
      },
    },
    include: { user: true },
  });

  if (existing) {
    return existing.user;
  }

  const usernameBase = `${opts.provider}_${opts.providerUserId}`.slice(0, 40).toLowerCase();
  let username = usernameBase;
  let n = 0;
  while (await prisma.user.findUnique({ where: { username } })) {
    n += 1;
    username = `${usernameBase}_${n}`.slice(0, 48);
  }

  const email =
    opts.email ??
    fingerprintEmail(opts.provider, opts.providerUserId);

  const user = await prisma.user.create({
    data: {
      username,
      email,
      displayName: opts.displayName.slice(0, 120) || 'Người dùng',
      passwordHash: null,
      role: 'user',
      avatarUrl: opts.avatarUrl,
      oauthAccounts: {
        create: {
          provider: opts.provider,
          providerUserId: opts.providerUserId,
          email: opts.email,
        },
      },
    },
  });
  return user;
}

export const GET = handleRoute(async (req: Request, { params }: { params: Promise<{ provider: string }> }) => {
  enforceRateLimit('auth-oauth', req, { limit: 30, windowMs: 60000 });
  const { provider: raw } = await params;
  const provider = raw.toLowerCase();
  if (!PROVIDERS.has(provider)) {
    throw new AppError(400, 'INVALID_INPUT', 'Nhà cung cấp OAuth không được hỗ trợ.');
  }

  const url = new URL(req.url);
  const state = url.searchParams.get('state') || '';
  const parsed = parseOAuthState(state);
  if (!parsed || parsed.provider !== provider) {
    throw new AppError(400, 'INVALID_INPUT', 'Phiên OAuth không hợp lệ hoặc đã hết hạn.');
  }

  const isDemo = url.searchParams.get('demo') === '1';
  let providerUserId: string;
  let email: string | null = null;
  let displayName: string;
  let avatarUrl: string | null = null;

  if (isDemo) {
    providerUserId = `demo-${provider}-user`;
    email = `demo.${provider}@example.vn`;
    displayName =
      provider === 'google' ? 'Công dân (Google demo)' : 'Công dân (Facebook demo)';
  } else {
    const code = url.searchParams.get('code');
    if (!code) {
      throw new AppError(400, 'INVALID_INPUT', 'Thiếu mã ủy quyền OAuth.');
    }
    // Production-style token exchange would go here when client secrets are set.
    // Without secrets we refuse non-demo callbacks.
    const secret =
      provider === 'google'
        ? process.env.GOOGLE_CLIENT_SECRET
        : process.env.FACEBOOK_APP_SECRET;
    if (!secret) {
      throw new AppError(
        501,
        'OAUTH_NOT_CONFIGURED',
        'OAuth thật chưa được cấu hình. Dùng chế độ demo hoặc thiết lập biến môi trường client secret.'
      );
    }
    // Minimal stub: treat code as opaque identity for environments that inject a mock upstream
    providerUserId = `live-${provider}-${code.slice(0, 24)}`;
    displayName = `Người dùng ${provider}`;
    email = null;
  }

  const user = await upsertOAuthUser({
    provider,
    providerUserId,
    email,
    displayName,
    avatarUrl,
  });

  if (user.role !== 'user') {
    throw new AppError(403, 'FORBIDDEN', 'Tài khoản OAuth chỉ dành cho cổng người dùng.');
  }

  const session = await createLoginSession(user.id, req);
  const redirectTo = `${url.origin}/user?logged_in=1&via=${provider}`;

  return new Response(null, {
    status: 302,
    headers: {
      Location: redirectTo,
      'Set-Cookie': session.cookie,
    },
  });
});
