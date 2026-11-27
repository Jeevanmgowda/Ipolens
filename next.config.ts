import type { NextConfig } from "next";
import path from "path";

const isDev = process.env.NODE_ENV !== 'production';

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
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      // React & Turbopack require 'unsafe-eval' in dev for hot reloading & callstack reconstruction
      isDev
        ? "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com/gsi/client"
        : "script-src 'self' 'unsafe-inline' https://accounts.google.com/gsi/client",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com/gsi/style",
      "font-src 'self' https://fonts.gstatic.com data:",
      "img-src 'self' data: https: blob:",
      isDev
        ? "connect-src 'self' http://localhost:* ws://localhost:* https://api.upstox.com https://generativelanguage.googleapis.com https://*.upstash.io https://accounts.google.com/gsi/ wss: ws:"
        : "connect-src 'self' https://api.upstox.com https://generativelanguage.googleapis.com https://*.upstash.io https://accounts.google.com/gsi/ wss: ws:",
      "frame-src 'self' https://accounts.google.com/gsi/",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join('; '),
  },
];

const nextConfig: NextConfig = {
  // Pin the workspace root to this project so a parent folder's lockfile/node_modules
  // (e.g. git worktrees nested inside the repo) is never used for module resolution.
  turbopack: { root: path.resolve(__dirname) },
  outputFileTracingRoot: path.resolve(__dirname),
  poweredByHeader: false,
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Apply security headers to all routes
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
