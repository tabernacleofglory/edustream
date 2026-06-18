import { NextRequest, NextResponse } from 'next/server';

function buildCsp(nonce: string): string {
  const isDev = process.env.NODE_ENV === 'development';

  const frameAncestors = [
    "'self'",
    "https://6000-firebase-studio-1753264491393.cluster-f4iwdviaqvc2ct6pgytzw4xqy4.cloudworkstations.dev",
    "https://workstations.cloud.google.com",
    "https://*.cloud.google.com",
    "https://*.cloudworkstations.dev",
    "https://*.googleusercontent.com",
    "https://*.google.com",
    "https://*.firebase.google.com",
    "https://*.firebaseapp.com",
    "https://studio.firebase.google.com",
  ].join(' ');

  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    "'strict-dynamic'",
    // Fallback domain allowlists for older browsers that don't support strict-dynamic
    "https://challenges.cloudflare.com",
    "https://*.googletagmanager.com",
    "https://*.google-analytics.com",
    "https://*.gstatic.com",
    "https://apis.google.com",
    "https://*.youtube.com",
    "https://*.youtube-nocookie.com",
    "https://embed.tawk.to",
    "https://*.tawk.to",
    "https://*.firebaseapp.com",
    "https://*.google.com",
    // unsafe-eval is required by Next.js Hot Module Replacement in dev mode only
    ...(isDev ? ["'unsafe-eval'"] : []),
  ].join(' ');

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://embed.tawk.to https://*.tawk.to",
    "font-src 'self' https://fonts.gstatic.com https://embed.tawk.to https://*.tawk.to data:",
    "img-src 'self' data: blob: https: https://*.tawk.to https://embed.tawk.to",
    "connect-src 'self' https: wss: https://*.googleapis.com https://*.firebaseio.com https://*.firebaseapp.com https://*.google-analytics.com https://*.tawk.to wss://*.tawk.to https://*.cloudworkstations.dev wss://*.cloudworkstations.dev",
    `frame-src 'self' https: https://*.tawk.to https://embed.tawk.to https://*.cloudworkstations.dev`,
    "media-src 'self' https: blob: https://*.googlevideo.com",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "form-action 'self'",
    `frame-ancestors ${frameAncestors}`,
    "upgrade-insecure-requests",
  ].join('; ');
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hostname = request.headers.get('host') || '';

  // ── Subdomain routing ─────────────────────────────────────────
  // Redirect non-homepage paths on the root domain to the app subdomain
  if (
    (hostname === 'glorytgtraining.com' || hostname === 'www.glorytgtraining.com') &&
    pathname !== '/'
  ) {
    const url = new URL(request.url);
    url.hostname = 'app.glorytgtraining.com';
    return NextResponse.redirect(url, 308);
  }

  // ── Security headers ──────────────────────────────────────────
  const nonce = crypto.randomUUID();
  const response = NextResponse.next();

  // Content-Security-Policy with per-request nonce
  response.headers.set('Content-Security-Policy', buildCsp(nonce));

  // Pass nonce to server-rendered layout via custom header
  response.headers.set('x-nonce', nonce);

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set(
    'Strict-Transport-Security',
    'max-age=15552000; includeSubDomains'
  );
  response.headers.set(
    'Cross-Origin-Opener-Policy',
    'same-origin-allow-popups'
  );
  response.headers.set(
    'Permissions-Policy',
    'camera=(self), microphone=(self), geolocation=(), payment=(), usb=(), interest-cohort=()'
  );

  // Admin routes: no-cache
  if (pathname.startsWith('/admin')) {
    response.headers.set('Cache-Control', 'no-store, max-age=0');
  }

  return response;
}

export const config = {
  matcher: ['/((?!api|static|.*\\..*|_next|favicon.ico|robots.txt).*)'],
};
