import { sitemapIndexXml } from '@/lib/seo/sitemap-entries';

/**
 * /sitemap.xml — the STABLE entry point (owner decision #6, PR-D). The URL
 * Search Console already has on file now serves a sitemap index whose five
 * children partition the same URL set the single sitemap carried, so
 * Discovered/Indexed become observable per family. Replaces the
 * app/sitemap.ts metadata convention, which cannot emit an index.
 */
export const revalidate = 3600;

export function GET(): Response {
  return new Response(sitemapIndexXml(), {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
}
