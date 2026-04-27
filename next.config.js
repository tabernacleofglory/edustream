
/** @type {import('next').NextConfig} */
const nextConfig = {
  poweredByHeader: false,

  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

  images: {
    unoptimized: true,
    remotePatterns: [
      { protocol: 'https', hostname: 'placehold.co', port: '', pathname: '/**' },
      { protocol: 'https', hostname: 'images.unsplash.com', port: '', pathname: '/**' },
      { protocol: 'https', hostname: 'firebasestorage.googleapis.com', port: '', pathname: '/**' },
      { protocol: 'https', hostname: 'storage.googleapis.com', port: '', pathname: '/edustream-videos-uscentral1/**' },
      { protocol: 'https', hostname: 'photos.google.com', port: '', pathname: '/**' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com', port: '', pathname: '/**' },
    ],
  },

  webpack(config) {
    config.experiments = { ...config.experiments, topLevelAwait: true, asyncWebAssembly: true };
    return config;
  },

  async headers() {
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

    const connectSrc = [
      "connect-src",
      "'self'",
      "https:",
      "wss:",
      "https://6000-firebase-studio-1753264491393.cluster-f4iwdviaqvc2ct6pgytzw4xqy4.cloudworkstations.dev",
      "https://*.googleapis.com",
      "https://*.firebaseio.com",
      "https://*.firebaseapp.com",
      "https://*.google-analytics.com",
      "https://*.tawk.to",
      "wss://*.tawk.to",
      "https://*.cloudworkstations.dev",
      "wss://*.cloudworkstations.dev",
    ].join(' ');

    const isDev = process.env.NODE_ENV === 'development';

    const scriptSrc = [
      "script-src",
      "'self'",
      "'unsafe-inline'",
      // unsafe-eval is required by Next.js Hot Module Replacement in dev mode.
      // It is intentionally excluded from production builds for security.
      ...(isDev ? ["'unsafe-eval'"] : []),
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
    ].join(' ');

    const cspValue = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      `frame-ancestors ${frameAncestors}`,
      scriptSrc,
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://embed.tawk.to https://*.tawk.to",
      "font-src 'self' https://fonts.gstatic.com https://embed.tawk.to https://*.tawk.to data:",
      "img-src 'self' data: blob: https: https://*.tawk.to https://embed.tawk.to",
      connectSrc,
      "frame-src 'self' https: https://*.tawk.to https://embed.tawk.to https://*.cloudworkstations.dev",
      "media-src 'self' https: blob: https://*.googlevideo.com",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
          { key: 'Content-Security-Policy', value: cspValue.replace(/\s{2,}/g, ' ').trim() },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=15552000; includeSubDomains' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
          },
        ],
      },
    ];
  },

  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
  },
};

module.exports = nextConfig;
