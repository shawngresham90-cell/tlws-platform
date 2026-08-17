import { entriesForFamily, urlsetXml } from '@/lib/seo/sitemap-entries';

/** Child sitemap: the "core" family (see lib/seo/sitemap-entries.ts). */
export const revalidate = 3600;

export async function GET(): Promise<Response> {
  return new Response(urlsetXml(await entriesForFamily('core')), {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
}
