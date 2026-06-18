
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

  experimental: {
    serverActions: { bodySizeLimit: '2mb' },
  },
};

module.exports = nextConfig;
