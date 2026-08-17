const SITE_URL = 'https://tools.barmeto.com';

// Private, login-gated dashboard — keep every crawler out entirely.
export default function robots() {
  return {
    rules: [{ userAgent: '*', disallow: '/' }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
