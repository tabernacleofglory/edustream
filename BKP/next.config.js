/** @type {import('next').NextConfig} */
const nextConfig = {
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
      { protocol: 'https', hostname: 'photos.google.com', port: '', pathname: '/**' }
    ],
  },
  webpack(config) {
    config.experiments = { ...config.experiments, topLevelAwait: true, asyncWebAssembly: true };
    return config;
  },
  async headers() {
    const studioFrameAncestors = [
      "'self'",
      "https://6000-firebase-studio-1753264491393.cluster-f4iwdviaqvc2ct6pgytzw4xqy4.cloudworkstations.dev",
      "https://9000-firebase-studio-1753264491393.cluster-f4iwdviaqvc2ct6pgytzw4xqy4.cloudworkstations.dev",
      "https://workstations.cloud.google.com",
      "https://*.cloud.google.com",
      "https://*.cloudworkstations.dev",
      "https://*.googleusercontent.com",
    ].join(' ');

    const ContentSecurityPolicy = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      `frame-ancestors ${studioFrameAncestors}`,
      [
        "script-src",
        "'self'",
        "'unsafe-inline'",
        "'unsafe-eval'",
        "https://challenges.cloudflare.com",
        "https://www.googletagmanager.com",
        "https://www.google-analytics.com",
        "https://www.gstatic.com",
        "https://apis.google.com",
        "https://www.youtube.com",
        "https://s.ytimg.com",
        "https://www.youtube-nocookie.com",
        "https://embed.tawk.to",
        "https://*.tawk.to",
      ].join(' '),
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://embed.tawk.to https://*.tawk.to",
      "font-src 'self' https://fonts.gstatic.com https://embed.tawk.to https://*.tawk.to data:",
      [
        "img-src",
        "'self'",
        "data:",
        "blob:",
        "https:",
        "https://*.ytimg.com",
        "https://i.ytimg.com",
        "https://img.youtube.com",
        "https://lh3.googleusercontent.com",
        "https://*.googleusercontent.com",
        "https://placehold.co",
        "https://images.unsplash.com",
        "https://*.tawk.to",
        "https://embed.tawk.to",
      ].join(' '),
      [
        "connect-src",
        "'self'",
        "https:",
        "wss:",
        "https://challenges.cloudflare.com",
        "https://*.googleapis.com",
        "https://identitytoolkit.googleapis.com",
        "https://securetoken.googleapis.com",
        "https://accounts.google.com",
        "https://*.googleusercontent.com",
        "https://*.firebaseio.com",
        "https://*.firebaseapp.com",
        "https://firebasestorage.googleapis.com",
        "https://storage.googleapis.com",
        "https://www.google-analytics.com",
        "https://www.youtube.com",
        "https://www.youtube-nocookie.com",
        "https://*.googlevideo.com",
        "https://*.tawk.to",
        "wss://*.tawk.to",
        "https://workstations.cloud.google.com",
        "https://*.cloud.google.com",
        "https://*.cloudworkstations.dev",
        "wss://*.cloudworkstations.dev",
      ].join(' '),
      [
        "frame-src",
        "'self'",
        "https://challenges.cloudflare.com",
        "https://accounts.google.com",
        "https://*.firebaseapp.com",
        "https://www.youtube.com",
        "https://www.youtube-nocookie.com",
        "https://*.youtube.com",
        "https://drive.google.com",
        "https://vdo.ninja",
        "https://*.tawk.to",
        "https://embed.tawk.to",
        "https://workstations.cloud.google.com",
        "https://*.cloud.google.com",
        "https://*.cloudworkstations.dev",
      ].join(' '),
      "media-src 'self' https: blob: https://*.googlevideo.com",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
      "upgrade-insecure-requests",
    ].join('; ');

    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Cache-Control', value: 'no-store, max-age=0' },
          { key: 'Content-Security-Policy', value: ContentSecurityPolicy },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security', value: 'max-age=15552000; includeSubDomains' },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()',
          },
        ],
      },
    ];
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '2mb',
    },
    devCache: false,
  },
};

module.exports = nextConfig;