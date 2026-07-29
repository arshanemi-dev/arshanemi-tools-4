const SITE_URL = 'https://tools.arshanemi.com';

// Private, login-gated dashboard — nothing here is meant to be indexed.
// A minimal sitemap is kept only because Next.js expects one at /sitemap.xml.
export default async function sitemap() {
  return [
    { url: SITE_URL, lastModified: new Date().toISOString(), changeFrequency: 'monthly', priority: 1.0 },
  ];
}
