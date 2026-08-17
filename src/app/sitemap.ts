import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/seo/site';
import { createStaticClient } from '@/lib/supabase/static';
import { DIRECTORY_CATEGORIES, categoryHref } from '@/lib/directory/categories';
import {
  getDirectoryFacets,
  getAllPublishedEntries,
  getParkingFacets,
  getCatScaleFacets,
} from '@/lib/directory/data';
import { stateByCode } from '@/lib/directory/states';
import { interstateSlug, exitSlug } from '@/lib/directory/interstates';
import { interstateToSlug, directionsForInterstate } from '@/lib/directory/corridor';
import { isDetailIndexable } from '@/lib/directory/detail';
import { detailHref } from '@/lib/directory/detail-slug';
import { STORE_CATEGORIES, storeCategoryHref } from '@/lib/store/categories';
import {
  STORE_PRODUCTS,
  productHref,
  productsInCategory,
  productsOfType,
} from '@/lib/store/products';
import { shawnsPicks } from '@/lib/store/picks';
import { DIRECT_PRODUCTS, directProductHref, SHIPPING_RETURNS_HREF } from '@/lib/store/direct';
import { STORE_GUIDES, guideHref } from '@/lib/store/product-types';
import { publishedTests, testHref } from '@/lib/tests/catalog';

/**
 * Sitemap. Static routes + every Knowledge Center category and published article,
 * pulled at build/revalidate. New KC content shows up automatically — no manual
 * XML edits. Uses the cookieless client so it runs outside a request scope.
 *
 * lastModified policy (2026-08-17 crawl/indexing audit): a <lastmod> is
 * emitted ONLY where a real, persisted content-modification date exists —
 * listing detail pages (locations.updated_at) and Knowledge Center articles
 * (kc_articles.updated_at). Every other entry omits the field. This route
 * regenerates hourly; stamping generation time made ~2,390 unchanged URLs
 * claim fresh modification on every pass, which teaches Google to distrust
 * the signal entirely. Never substitute build/request/deploy time for a
 * modification date.
 */
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = [
    { url: SITE.url, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE.url}/knowledge`, changeFrequency: 'daily', priority: 0.9 },
    // Founders Wall (Milestone 9).
    { url: `${SITE.url}/founders`, changeFrequency: 'weekly', priority: 0.8 },
    // CDL Pre-School (Founding Student offer).
    {
      url: `${SITE.url}/cdl-pre-school`,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${SITE.url}/cdl-pre-school/founding-students`,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${SITE.url}/cdl-pre-school/founding-student-claim`,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
  ];

  // Top-level public destinations that had no sitemap entry: THE ROAD AHEAD,
  // Trip Planner, Books, Apps, the sponsor front door, the DOT Tools
  // informational landing, and the legal pages.
  //
  // `/directory/parking` deliberately is NOT here: it is the `parking`
  // category's `customHref`, so the DIRECTORY_CATEGORIES loop below already
  // emits it. Listing it twice put a duplicate <url> in the sitemap.
  const topLevelPaths: Array<[string, number]> = [
    ['/road-ahead', 0.7],
    ['/trip-planner', 0.8],
    ['/books', 0.8],
    ['/apps', 0.6],
    ['/sponsors', 0.6],
    ['/dot-tools', 0.6],
    ['/tools/hos-calculator', 0.7],
    ['/supply-the-classroom', 0.8],
    ['/privacy', 0.3],
    ['/terms', 0.3],
    ['/sms-terms', 0.3],
  ];
  for (const [path, priority] of topLevelPaths) {
    entries.push({
      url: `${SITE.url}${path}`,
      changeFrequency: 'weekly',
      priority,
    });
  }

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
      changeFrequency: 'weekly',
      priority: path === '/academy' ? 0.9 : 0.7,
    });
  }

  // Trucking Life Store — hub, every category, and every product. Placeholder
  // products are still crawlable content pages (no active affiliate link until
  // an ASIN is confirmed), so they belong in the sitemap.
  entries.push({
    url: `${SITE.url}/store`,
    changeFrequency: 'weekly',
    priority: 0.8,
  });
  // Physical-product policy — public and stable.
  entries.push({
    url: `${SITE.url}${SHIPPING_RETURNS_HREF}`,
    changeFrequency: 'yearly',
    priority: 0.4,
  });
  // Trucking Life's own products — always public, so always listed.
  for (const product of DIRECT_PRODUCTS) {
    entries.push({
      url: `${SITE.url}${directProductHref(product.slug)}`,
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }
  // Only categories that actually have a publicly visible product. A category
  // whose products are all hidden renders an empty page — submitting it would
  // be asking Google to index nothing.
  for (const category of STORE_CATEGORIES) {
    if (productsInCategory(category.slug).length === 0) continue;
    entries.push({
      url: `${SITE.url}${storeCategoryHref(category.slug)}`,
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }
  for (const product of STORE_PRODUCTS) {
    entries.push({
      url: `${SITE.url}${productHref(product.slug)}`,
      changeFrequency: 'weekly',
      priority: 0.6,
    });
  }
  // Buying guides (M54) + Shawn's Picks — each listed only while it still has
  // visible products to show, for the same reason as the categories above.
  const visibleGuides = STORE_GUIDES.filter((g) => productsOfType(g.productType).length > 0);
  if (visibleGuides.length > 0) {
    entries.push({
      url: `${SITE.url}/store/guides`,
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }
  if (shawnsPicks().length > 0) {
    entries.push({
      url: `${SITE.url}/store/shawns-picks`,
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }
  for (const guide of visibleGuides) {
    entries.push({
      url: `${SITE.url}${guideHref(guide.slug)}`,
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }

  // Practice Tests (Milestone 1) — hub + every published test landing. Tests
  // render from the TS catalog, so their URLs ship even before a bank is seeded.
  entries.push({
    url: `${SITE.url}/practice-tests`,
    changeFrequency: 'weekly',
    priority: 0.8,
  });
  for (const test of publishedTests()) {
    entries.push({
      url: `${SITE.url}${testHref(test.slug)}`,
      changeFrequency: 'weekly',
      priority: 0.7,
    });
  }

  // Directory Engine (Milestone 11) — hub + every category in the registry.
  entries.push({
    url: `${SITE.url}/directory`,
    changeFrequency: 'weekly',
    priority: 0.8,
  });
  // Public interactive map (Milestone 19).
  entries.push({
    url: `${SITE.url}/directory/map`,
    changeFrequency: 'weekly',
    priority: 0.8,
  });
  // Driver community (Milestone 16): submissions + reviews.
  entries.push(
    {
      url: `${SITE.url}/directory/submit`,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${SITE.url}/directory/reviews`,
      changeFrequency: 'daily',
      priority: 0.7,
    },
    // Growth surfaces (Milestone 25).
    {
      url: `${SITE.url}/directory/recently-updated`,
      changeFrequency: 'daily',
      priority: 0.6,
    },
    {
      url: `${SITE.url}/directory/new-locations`,
      changeFrequency: 'daily',
      priority: 0.6,
    },
  );
  for (const category of DIRECTORY_CATEGORIES) {
    entries.push({
      url: `${SITE.url}${categoryHref(category)}`,
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
      entries.push({
        url: `${SITE.url}/directory/${state.slug}`,
        changeFrequency: 'weekly',
        priority: 0.7,
      });
      // Top-truck-stops landing page for the state (Milestone 25).
      entries.push({
        url: `${SITE.url}/directory/${state.slug}/top-truck-stops`,
        changeFrequency: 'weekly',
        priority: 0.6,
      });
    }
    for (const designation of facets.interstates) {
      const slug = interstateSlug(designation);
      if (!slug) continue;
      entries.push({
        url: `${SITE.url}/directory/${slug}`,
        changeFrequency: 'weekly',
        priority: 0.7,
      });
      // Corridor parking landing page (Milestone 25).
      entries.push({
        url: `${SITE.url}/directory/${slug}/truck-parking`,
        changeFrequency: 'weekly',
        priority: 0.6,
      });
      for (const exit of facets.exitsByInterstate[designation] ?? []) {
        entries.push({
          url: `${SITE.url}/directory/${slug}/${exitSlug(exit)}`,
          changeFrequency: 'weekly',
          priority: 0.6,
        });
      }
    }
  } catch {
    // Directory facet URLs are additive — a DB hiccup still ships the rest.
  }

  // Corridor-flow pages (driver-first navigation, 2026-07-28/29): the Parking
  // and CAT Scale State → Interstate → Direction steps plus the CAT Scale
  // Near Me search. All indexable, self-canonical public pages — they shipped
  // after the July sitemap audit and were never listed here. Facet-driven
  // like the state/corridor loops above, so a step appears only when
  // published listings exist behind it, matching each page's own gates.
  entries.push({
    url: `${SITE.url}/directory/cat-scales/near-me`,
    changeFrequency: 'weekly',
    priority: 0.7,
  });
  try {
    const flows = [
      { base: '/directory/parking', facets: await getParkingFacets() },
      { base: '/directory/cat-scales', facets: await getCatScaleFacets() },
    ];
    for (const { base, facets } of flows) {
      for (const { code } of facets.states) {
        if (!stateByCode(code)) continue;
        const statePath = `${base}/${code.toLowerCase()}`;
        entries.push({
          url: `${SITE.url}${statePath}`,
          changeFrequency: 'weekly',
          priority: 0.6,
        });
        for (const { designation } of facets.interstatesByState[code] ?? []) {
          const corridorPath = `${statePath}/${interstateToSlug(designation)}`;
          entries.push({
            url: `${SITE.url}${corridorPath}`,
            changeFrequency: 'weekly',
            priority: 0.6,
          });
          for (const direction of directionsForInterstate(designation)) {
            entries.push({
              url: `${SITE.url}${corridorPath}/${direction}`,
              changeFrequency: 'weekly',
              priority: 0.6,
            });
          }
        }
      }
    }
  } catch {
    // Corridor-flow URLs are additive too.
  }

  // Per-listing detail pages (Milestone 20). Only pages past the completeness
  // gate are listed — thin listings render with noindex and stay out of the
  // sitemap until their data fills in.
  try {
    const listings = await getAllPublishedEntries();
    for (const entry of listings) {
      if (!entry.detailSlug || !isDetailIndexable(entry)) continue;
      // Real modification date only; a row without one gets no <lastmod>
      // rather than a fabricated "now".
      entries.push({
        url: `${SITE.url}${detailHref(entry.detailSlug)}`,
        ...(entry.updatedAt ? { lastModified: new Date(entry.updatedAt) } : {}),
        changeFrequency: 'weekly',
        priority: 0.6,
      });
    }
  } catch {
    // Detail URLs are additive too.
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
        updated_at: string | null;
        kc_categories: { slug: string };
      };
      // Same policy as detail pages: only the article's own updated_at, and
      // only when the row actually carries one.
      entries.push({
        url: `${SITE.url}/knowledge/${row.kc_categories.slug}/${row.slug}`,
        ...(row.updated_at ? { lastModified: new Date(row.updated_at) } : {}),
        changeFrequency: 'monthly',
        priority: 0.6,
      });
    }
  } catch {
    // If the DB is unreachable at build, still ship the static sitemap.
  }

  // One <url> per URL. Entries come from a static list, four registries, and
  // two database queries, so the same page can legitimately be reached from
  // more than one of them (a category's `customHref` and a hand-added
  // top-level path, say). First writer wins — the earlier blocks are the more
  // specific ones.
  return dedupeByUrl(entries);
}

function dedupeByUrl(entries: MetadataRoute.Sitemap): MetadataRoute.Sitemap {
  const seen = new Set<string>();
  const out: MetadataRoute.Sitemap = [];
  for (const entry of entries) {
    if (seen.has(entry.url)) continue;
    seen.add(entry.url);
    out.push(entry);
  }
  return out;
}
