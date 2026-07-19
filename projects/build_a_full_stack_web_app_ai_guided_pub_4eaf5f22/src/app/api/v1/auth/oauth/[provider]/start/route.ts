import { AppError, handleRoute } from '@/lib/errors';
import { oauthStateToken } from '@/lib/login-auth';
import { enforceRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PROVIDERS = new Set(['google', 'facebook']);

/**
 * Start OAuth. When real client IDs are not configured, falls back to demo callback
 * so the flow is usable in local/hackathon demos.
 */
export const GET = handleRoute(async (req: Request, { params }: { params: Promise<{ provider: string }> }) => {
  enforceRateLimit('auth-oauth', req, { limit: 30, windowMs: 60000 });
  const { provider: raw } = await params;
  const provider = raw.toLowerCase();
  if (!PROVIDERS.has(provider)) {
    throw new AppError(400, 'INVALID_INPUT', 'Nhà cung cấp OAuth không được hỗ trợ.');
  }

  const url = new URL(req.url);
  const portal = (url.searchParams.get('portal') || 'user').toLowerCase();
  if (portal !== 'user') {
    throw new AppError(
      400,
      'INVALID_INPUT',
      'Đăng nhập Google/Facebook chỉ áp dụng cho cổng người dùng.'
    );
  }

  // Lấy chính xác protocol và host để tránh lỗi HTTP/HTTPS đằng sau proxy (Vercel)
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host') || url.host;
  const proto = req.headers.get('x-forwarded-proto') || (host.includes('localhost') ? 'http' : 'https');
  const origin = `${proto}://${host}`;

  const state = oauthStateToken(portal, provider);
  const callback = `${origin}/api/v1/auth/oauth/${provider}/callback`;

  if (provider === 'google') {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (clientId) {
      // Equivalent of NextAuth GoogleProvider authorization.params — always force
      // the account chooser + consent, never silently reuse the browser Google session.
      // Client may pass ?prompt=... but we never allow a weaker value than select_account.
      const clientPrompt = (url.searchParams.get('prompt') || '').trim();
      const prompt =
        clientPrompt.includes('select_account') && clientPrompt.includes('consent')
          ? clientPrompt
          : 'consent select_account';

      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', callback);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'openid email profile');
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('access_type', 'offline');
      authUrl.searchParams.set('include_granted_scopes', 'false');
      authUrl.searchParams.set('prompt', prompt);
      return Response.redirect(authUrl.toString(), 302);
    }
  }

  if (provider === 'facebook') {
    const clientId = process.env.FACEBOOK_APP_ID?.trim();
    if (clientId) {
      const authUrl = new URL('https://www.facebook.com/v18.0/dialog/oauth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', callback);
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('scope', 'email,public_profile');
      return Response.redirect(authUrl.toString(), 302);
    }
  }

  // Demo fallback — no real OAuth credentials configured.
  // This path NEVER opens Google's account chooser; it invents a local session.
  // Set GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET (or FACEBOOK_APP_ID) in .env to use real OAuth.
  console.warn(
    `[oauth/${provider}] missing client credentials — using demo callback (no Google account picker).`
  );
  const demo = new URL(callback);
  demo.searchParams.set('demo', '1');
  demo.searchParams.set('state', state);
  return Response.redirect(demo.toString(), 302);
});
