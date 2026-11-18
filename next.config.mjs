import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Browser-side protections sent with every response.
//  - nosniff: a file is only ever treated as the type the server says it is.
//  - Referrer-Policy: another site gets this app's origin at most, never a
//    full URL — the hub's sign-in handoff briefly carries tokens in the URL
//    (lib/tokenHandoff.js).
//  - Permissions-Policy: nothing here uses the camera, microphone or location.
//  - frame-ancestors: WHO may show this app inside a frame — always this app
//    and the hub (NEXT_PUBLIC_ADMIN_API_URL, which embeds it), plus any sites
//    in FRAME_ANCESTORS (see .env.example). It used to be sent only when
//    FRAME_ANCESTORS was set, leaving every other site free to frame it.
const frameAncestors = (process.env.FRAME_ANCESTORS || '')
  .split(/[\s,]+/)
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);

function hubOrigins() {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_ADMIN_API_URL || '')
    const host = url.hostname
    const twin = host.includes('.') && !/^[d.]+$/.test(host)
      ? [`${url.protocol}//${host.startsWith('www.') ? host.slice(4) : `www.${host}`}${url.port ? `:${url.port}` : ''}`]
      : []
    return [url.origin, ...twin]
  } catch {
    return []
  }
}

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  // Always sent: without it (FRAME_ANCESTORS unset) any site could frame
  // this app — clickjacking. Defaults to this app + the admin panel, which
  // embeds it in an iframe; FRAME_ANCESTORS adds more origins.
  { key: 'Content-Security-Policy', value: `frame-ancestors ${["'self'", ...hubOrigins(), ...frameAncestors].join(' ')}` },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Pin the project root — this repo is nested inside another repo's
  // node_modules/lockfile tree, which otherwise makes Next infer the wrong
  // workspace root and warn on every run.
  outputFileTracingRoot: __dirname,
  // The Redis client (lib/cache.js) is loaded by Node as it is, not bundled.
  serverExternalPackages: ['ioredis'],
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
