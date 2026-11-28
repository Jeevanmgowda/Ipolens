import type { NextConfig } from "next";
import { API_CSP } from "./src/lib/security/csp";


const securityHeaders = [
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'on',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=()',
  },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    // The proxy buffers request bodies (10 MB by default). Allow the 25 MB DRHP upload plus
    // multipart overhead; per-route limits are enforced in src/lib/security/bodyLimits.ts.
    proxyClientMaxBodySize: '28mb',
  },
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
      {
        // Pages get a per-request nonce CSP from src/proxy.ts (src/lib/security/csp.ts).
        // API responses get a deny-all CSP here.
        source: '/api/:path*',
        headers: [{ key: 'Content-Security-Policy', value: API_CSP }],
      },
    ];
  },
};

export default nextConfig;
