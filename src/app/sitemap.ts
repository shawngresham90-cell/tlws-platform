import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/seo/site';
import { createStaticClient } from '@/lib/supabase/static';
import { DIRECTORY_CATEGORIES, categoryHref } from '@/lib/directory/categories';

/**
 * Sitemap. Static routes + every Knowledge Center category and published article,
 * pulled at build/revalidate. New KC content shows up automatically — no manual
 * XML edits. Uses the cookieless client so it runs outside a request scope.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [
    { url: SITE.url, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE.url}/knowledge`, lastModified: now, changeFrequency: 'daily', priority: 0.9 },
    // Founders Wall (Milestone 9).
    { url: `${SITE.url}/founders`, lastModified: now, changeFrequency: 'weekly', priority: 0.8 },
  ];

  // Academy module (Milestone 7) — static routes.
  const academyPaths = [
    '/academy',
    '/academy/curriculum',
    '/academy/requirements',
    '/academy/financing',
    '/academy/facility',
    '/academy/instructors',
    '/academy/faq',
    '/academy/cdl-school-dalton-ga',
    '/academy/apply',
  ];
  for (const path of academyPaths) {
    entries.push({
      url: `${SITE.url}${path}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: path === '/academy' ? 0.9 : 0.7,
    });
  }

  // Directory Engine (Milestone 11) — hub + every category in the registry.
  entries.push({
    url: `${SITE.url}/directory`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.8,
  });
  for (const category of DIRECTORY_CATEGORIES) {
    entries.push({
      url: `${SITE.url}${categoryHref(category)}`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }

  try {
    const supabase = createStaticClient();
    const { data: cats } = await supabase
      .from('kc_categories')
      .select('slug')
      .eq('is_active', true);
    for (const c of cats ?? []) {
      entries.push({
        url: `${SITE.url}/knowledge/${(c as { slug: string }).slug}`,
        lastModified: now,
        changeFrequency: 'weekly',
        priority: 0.7,
      });
    }
    const { data: arts } = await supabase
      .from('kc_articles')
      .select('slug, updated_at, kc_categories!inner(slug)')
      .eq('status', 'published');
    for (const a of arts ?? []) {
      const row = a as unknown as {
        slug: string;
        updated_at: string;
        kc_categories: { slug: string };
      };
      entries.push({
        url: `${SITE.url}/knowledge/${row.kc_categories.slug}/${row.slug}`,
        lastModified: new Date(row.updated_at),
        changeFrequency: 'monthly',
        priority: 0.6,
      });
    }
  } catch {
    // If the DB is unreachable at build, still ship the static sitemap.
  }

  return entries;
}
