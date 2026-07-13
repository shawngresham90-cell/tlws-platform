import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/seo/site';
import { createStaticClient } from '@/lib/supabase/static';
import { DIRECTORY_CATEGORIES, categoryHref } from '@/lib/directory/categories';
import { getDirectoryFacets, getAllPublishedEntries } from '@/lib/directory/data';
import { stateByCode } from '@/lib/directory/states';
import { interstateSlug, exitSlug } from '@/lib/directory/interstates';
import { isDetailIndexable } from '@/lib/directory/detail';
import { detailHref } from '@/lib/directory/detail-slug';
import {
  computeFreshness,
  exitKey,
  lastModifiedOr,
  type FreshnessMaps,
} from '@/lib/directory/sitemap-freshness';
import type { DirectoryEntry } from '@/lib/directory/types';

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

  // Freshness: hub pages (directory / category / state / interstate / exit) are
  // aggregations of published listings, so their lastmod is the newest
  // updated_at among the listings they contain — not the sitemap build time.
  // Best-effort: any DB hiccup falls back to `now` everywhere below.
  let listings: DirectoryEntry[] = [];
  let fresh: FreshnessMaps = computeFreshness([]);
  try {
    listings = await getAllPublishedEntries();
    fresh = computeFreshness(listings);
  } catch {
    // Freshness is additive; the static sitemap still ships.
  }
  const dirHubLm = lastModifiedOr(fresh.global, now);

  // Directory Engine (Milestone 11) — hub + every category in the registry.
  entries.push({
    url: `${SITE.url}/directory`,
    lastModified: dirHubLm,
    changeFrequency: 'weekly',
    priority: 0.8,
  });
  // Public interactive map (Milestone 19).
  entries.push({
    url: `${SITE.url}/directory/map`,
    lastModified: now,
    changeFrequency: 'weekly',
    priority: 0.8,
  });
  // Driver community (Milestone 16): submissions + reviews.
  entries.push(
    {
      url: `${SITE.url}/directory/submit`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${SITE.url}/directory/reviews`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    // Growth surfaces (Milestone 25).
    {
      url: `${SITE.url}/directory/recently-updated`,
      lastModified: dirHubLm,
      changeFrequency: 'daily',
      priority: 0.6,
    },
    {
      url: `${SITE.url}/directory/new-locations`,
      lastModified: dirHubLm,
      changeFrequency: 'daily',
      priority: 0.6,
    },
  );
  for (const category of DIRECTORY_CATEGORIES) {
    entries.push({
      url: `${SITE.url}${categoryHref(category)}`,
      lastModified: lastModifiedOr(fresh.byCategory.get(category.slug) ?? null, now),
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }

  // State pages, interstate corridors, and exit pages come from the published
  // data itself — a new state's import adds its URLs on the next revalidation.
  try {
    const facets = await getDirectoryFacets();
    for (const code of facets.states) {
      const state = stateByCode(code);
      if (!state) continue;
      const stateLm = lastModifiedOr(fresh.byState.get(code) ?? null, now);
      entries.push({
        url: `${SITE.url}/directory/${state.slug}`,
        lastModified: stateLm,
        changeFrequency: 'weekly',
        priority: 0.7,
      });
      // Top-truck-stops landing page for the state (Milestone 25).
      entries.push({
        url: `${SITE.url}/directory/${state.slug}/top-truck-stops`,
        lastModified: stateLm,
        changeFrequency: 'weekly',
        priority: 0.6,
      });
    }
    for (const designation of facets.interstates) {
      const slug = interstateSlug(designation);
      if (!slug) continue;
      const interstateLm = lastModifiedOr(fresh.byInterstate.get(designation) ?? null, now);
      entries.push({
        url: `${SITE.url}/directory/${slug}`,
        lastModified: interstateLm,
        changeFrequency: 'weekly',
        priority: 0.7,
      });
      // Corridor parking landing page (Milestone 25).
      entries.push({
        url: `${SITE.url}/directory/${slug}/truck-parking`,
        lastModified: interstateLm,
        changeFrequency: 'weekly',
        priority: 0.6,
      });
      for (const exit of facets.exitsByInterstate[designation] ?? []) {
        entries.push({
          url: `${SITE.url}/directory/${slug}/${exitSlug(exit)}`,
          lastModified: lastModifiedOr(fresh.byExit.get(exitKey(designation, exit)) ?? null, now),
          changeFrequency: 'weekly',
          priority: 0.6,
        });
      }
    }
  } catch {
    // Directory facet URLs are additive — a DB hiccup still ships the rest.
  }

  // Per-listing detail pages (Milestone 20). Reuses the listings fetched above
  // for freshness. Only pages past the completeness gate are listed — thin
  // listings render with noindex and stay out of the sitemap until their data
  // fills in.
  for (const entry of listings) {
    if (!entry.detailSlug || !isDetailIndexable(entry)) continue;
    entries.push({
      url: `${SITE.url}${detailHref(entry.detailSlug)}`,
      lastModified: entry.updatedAt ? new Date(entry.updatedAt) : now,
      changeFrequency: 'weekly',
      priority: 0.6,
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
