import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const LOGIN_COOKIE = 'psp_login';

/**
 * Soft gate: ensure cookie exists for protected portal routes.
 * Full role checks happen in server layouts / API (DB-backed).
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const requestHeaders = new Headers(req.headers);
  requestHeaders.set('x-pathname', pathname);

  // Widget iframe: /user/chat?embed=1 — layout hides UserBar via this header
  const isEmbed =
    req.nextUrl.searchParams.get('embed') === '1' ||
    req.nextUrl.searchParams.get('embed') === 'true';
  if (isEmbed) {
    requestHeaders.set('x-embed', '1');
  }

  const isUserLogin = pathname === '/user/login' || pathname.startsWith('/user/login/');
  const isManagerLogin = pathname === '/manager/login' || pathname.startsWith('/manager/login/');
  const isAdminLogin = pathname === '/admin/login' || pathname.startsWith('/admin/login/');

  const isUserProtected = pathname === '/user' || pathname.startsWith('/user/');
  const isManagerProtected = pathname === '/manager' || pathname.startsWith('/manager/');
  const isAdminProtected = pathname === '/admin' || pathname.startsWith('/admin/');

  const hasCookie = Boolean(req.cookies.get(LOGIN_COOKIE)?.value);

  // Embedded widget chat is anonymous by design (it uses the intake
  // session-token flow, not the login cookie) — never bounce it to login.
  if (isUserProtected && !isUserLogin && !hasCookie && !isEmbed) {
    const url = req.nextUrl.clone();
    url.pathname = '/user/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (isManagerProtected && !isManagerLogin && !hasCookie) {
    const url = req.nextUrl.clone();
    url.pathname = '/manager/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  if (isAdminProtected && !isAdminLogin && !hasCookie) {
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Do NOT bounce cookie holders off login pages here — wrong-role sessions
  // must be able to open /admin/login without looping (role checked in layout).

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ['/user/:path*', '/manager/:path*', '/admin/:path*'],
};
