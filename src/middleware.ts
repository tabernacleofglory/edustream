
import { NextRequest, NextResponse } from 'next/server';

/**
 * Lightweight middleware guard.
 *
 * Note: This app uses client-side Firebase Auth only — no session cookie
 * is created at login, so server-side cookie verification would lock out
 * all authenticated users. Full server-side auth requires implementing
 * session cookie creation in the login flow (future enhancement).
 *
 * What this does today:
 *  1. Blocks non-browser automated requests (bots/scanners) from /admin routes.
 *  2. Prevents direct URL access to /admin from tools like curl without a
 *     proper browser User-Agent, reducing surface area for automated attacks.
 *  3. Adds a no-cache header to all /admin pages.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Guard admin routes against non-browser automated requests
  if (pathname.startsWith('/admin')) {
    const userAgent = request.headers.get('user-agent') || '';
    const isBrowser = /Mozilla|Chrome|Safari|Firefox|Edge|Opera/i.test(userAgent);

    if (!isBrowser) {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // Add no-cache and no-store for all admin responses
    const response = NextResponse.next();
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|static|.*\\..*|_next|favicon.ico|robots.txt).*)'],
};
