import { AppError, handleRoute } from '@/lib/errors';
import { oauthStateToken } from '@/lib/login-auth';
import { enforceRateLimit } from '@/lib/rate-limit';

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

  const origin = url.origin;
  const state = oauthStateToken(portal, provider);
  const callback = `${origin}/api/v1/auth/oauth/${provider}/callback`;

  if (provider === 'google') {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    if (clientId) {
      const authUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authUrl.searchParams.set('client_id', clientId);
      authUrl.searchParams.set('redirect_uri', callback);
      authUrl.searchParams.set('response_type', 'code');
      authUrl.searchParams.set('scope', 'openid email profile');
      authUrl.searchParams.set('state', state);
      authUrl.searchParams.set('prompt', 'select_account');
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

  // Demo fallback — no real OAuth credentials configured
  const demo = new URL(callback);
  demo.searchParams.set('demo', '1');
  demo.searchParams.set('state', state);
  return Response.redirect(demo.toString(), 302);
});
