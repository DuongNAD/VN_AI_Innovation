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

    if (provider === 'google') {
      const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
      const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
      if (!clientId || !clientSecret) {
        throw new AppError(501, 'OAUTH_NOT_CONFIGURED', 'Google OAuth chưa được cấu hình Client ID và Secret.');
      }

      const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || url.host;
      const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
      const origin = `${proto}://${host}`;
      const callbackUrl = `${origin}/api/v1/auth/oauth/google/callback`;

      // 1. Trao đổi Auth Code lấy Access Token
      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          code,
          grant_type: 'authorization_code',
          redirect_uri: callbackUrl,
        }),
      });

      if (!tokenResponse.ok) {
        console.error('Lỗi khi lấy Access Token Google:', await tokenResponse.text());
        throw new AppError(400, 'OAUTH_ERROR', 'Không thể trao đổi mã token với Google.');
      }

      const tokenData = await tokenResponse.json();

      // 2. Dùng Access Token để lấy thông tin Người dùng (User Info)
      const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!userResponse.ok) {
        console.error('Lỗi lấy User Info Google:', await userResponse.text());
        throw new AppError(400, 'OAUTH_ERROR', 'Không thể lấy thông tin người dùng từ Google.');
      }

      const userInfo = await userResponse.json();

      providerUserId = userInfo.id;
      email = userInfo.email || null;
      displayName = userInfo.name || 'Người dùng Google';
      avatarUrl = userInfo.picture || null;

    } else {
      // Logic mock cũ giữ lại cho Facebook nếu sau này cần
      const secret = process.env.FACEBOOK_APP_SECRET;
      if (!secret) {
        throw new AppError(
          501,
          'OAUTH_NOT_CONFIGURED',
          'OAuth thật chưa được cấu hình. Dùng chế độ demo hoặc thiết lập biến môi trường client secret.'
        );
      }
      providerUserId = `live-${provider}-${code.slice(0, 24)}`;
      displayName = `Người dùng ${provider}`;
      email = null;
    }
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
