import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
      // The dashboard must never be framed by other sites; the preview may only be framed by the dashboard.
      { source: '/dashboard/:path*', headers: [{ key: 'X-Frame-Options', value: 'DENY' }] },
      { source: '/', headers: [{ key: 'X-Frame-Options', value: 'DENY' }] },
      { source: '/sign-in/:path*', headers: [{ key: 'X-Frame-Options', value: 'DENY' }] },
      { source: '/sign-up/:path*', headers: [{ key: 'X-Frame-Options', value: 'DENY' }] },
      { source: '/no-access', headers: [{ key: 'X-Frame-Options', value: 'DENY' }] },
      { source: '/preview', headers: [{ key: 'X-Frame-Options', value: 'SAMEORIGIN' }] },
    ];
  },
};

export default nextConfig;
