import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Browser-side protections sent with every response.
//  - nosniff: a file is only ever treated as the type the server says it is.
//  - Referrer-Policy: another site gets this app's origin at most, never a
//    full URL — the hub's sign-in handoff briefly carries tokens in the URL
//    (lib/tokenHandoff.js).
//  - Permissions-Policy: nothing here uses the camera, microphone or location.
//  - frame-ancestors: WHO may show this app inside a frame. The app is meant
//    to be embedded by the hub, so there is no safe default to guess — it is
//    only sent when FRAME_ANCESTORS lists the allowed sites (see
//    .env.example). Unset, any site may frame it, exactly as before.
const frameAncestors = (process.env.FRAME_ANCESTORS || '')
  .split(/[\s,]+/)
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  ...(frameAncestors.length
    ? [{ key: 'Content-Security-Policy', value: `frame-ancestors 'self' ${frameAncestors.join(' ')}` }]
    : []),
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the project root — this repo is nested inside another repo's
  // node_modules/lockfile tree, which otherwise makes Next infer the wrong
  // workspace root and warn on every run.
  outputFileTracingRoot: __dirname,
  async headers() {
    return [{ source: '/(.*)', headers: securityHeaders }];
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com',
      },
      {
        protocol: 'https',
        hostname: 'www.santhyainfotech.com',
        pathname: '/wp-content/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
    ],
  },
};

export default nextConfig;
