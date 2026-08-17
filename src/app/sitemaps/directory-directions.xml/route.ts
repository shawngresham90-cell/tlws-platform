import { entriesForFamily, urlsetXml } from '@/lib/seo/sitemap-entries';

/** Child sitemap: the "directory-directions" family (see lib/seo/sitemap-entries.ts). */
export const revalidate = 3600;

export async function GET(): Promise<Response> {
  return new Response(urlsetXml(await entriesForFamily('directory-directions')), {
    headers: { 'content-type': 'application/xml; charset=utf-8' },
  });
}
