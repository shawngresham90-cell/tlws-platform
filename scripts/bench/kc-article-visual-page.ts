/**
 * Renders the Class A vs Class B article page to static HTML with the
 * KC-VIS-1 visual registered, and prints it to stdout. Input for
 * `kc-article-visual-viewports.mjs`, which loads that HTML in a real browser.
 *
 * The page markup is the REAL page module's output — same components, same
 * next/image URLs, same class names — so what the bench measures is what
 * production serves. The article row is a fixture (this environment has no
 * database) built from the committed migration body, so the prose, headings
 * and comparison list are the published text.
 *
 * The visual comes from the repository registry — the approved artwork is
 * committed, so this renders exactly what production renders. The bench
 * fulfils the resulting image requests with the real committed bytes.
 *
 * Run (via the bench, not directly):
 *   npx esbuild scripts/bench/kc-article-visual-page.ts --bundle \
 *     --platform=node --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --alias:next/headers=./scripts/shims/next-headers.ts \
 *     --alias:next/cache=./scripts/shims/next-cache.ts \
 *     --loader:.css=empty --outfile=/tmp/kc-vis-page.cjs && node /tmp/kc-vis-page.cjs
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { ARTICLE_VISUALS } from '@/lib/kc/article-visuals';
import type { KcArticle, KcCategory } from '@/lib/kc/types';
import ArticlePage from '@/app/(marketing)/knowledge/[category]/[slug]/page';
import { installPostgrestFake } from '../helpers/postgrest-fake';

const KEY = 'getting-your-cdl/class-a-vs-class-b-cdl';
const seed = fs.readFileSync(
  path.join(process.cwd(), 'supabase/migrations/055_seed_kc_class_a_vs_class_b.sql'),
  'utf8',
);
const body = /\$mdx\$([\s\S]*?)\$mdx\$/.exec(seed)?.[1] ?? '';

const CATEGORY: KcCategory = {
  id: 'cat-gyc',
  slug: 'getting-your-cdl',
  name: 'Getting Your CDL',
  description: 'The road from zero to CDL.',
  intro_md: null,
  icon: 'map',
  sort_order: 6,
  meta_title: null,
  meta_description: null,
};
const ARTICLE: KcArticle = {
  id: 'art-ab',
  slug: 'class-a-vs-class-b-cdl',
  category_id: CATEGORY.id,
  title: 'Class A vs Class B CDL: Which One Should You Get?',
  excerpt:
    'Class A or Class B is the first real decision of a trucking career. The federal definitions in plain English, the jobs each license actually supports, what a later B-to-A upgrade involves, and the Georgia licensing path for either class.',
  body_mdx: body,
  meta_title: 'Class A vs Class B CDL: Which One Should You Get? | Trucking Life with Shawn',
  meta_description: 'Class A covers combinations; Class B covers heavy single trucks.',
  hero_image_url: null,
  author_name: 'Shawn Gresham',
  author_bio: 'CDL-A driver and instructor — 17 years driving, zero violations.',
  sources: [
    {
      label: '49 CFR 383.91 (eCFR)',
      url: 'https://www.ecfr.gov/current/title-49/part-383/section-383.91',
    },
  ],
  faqs: [
    {
      q: 'Can I drive a tractor-trailer with a Class B CDL?',
      a: 'No — that is a Group A vehicle.',
    },
  ],
  tags: ['getting-your-cdl'],
  reading_time_min: 8,
  featured: false,
  reg_verified: true,
  reg_verified_date: '2026-08-19',
  published_at: '2026-08-19T15:00:00Z',
  updated_at: '2026-08-19T15:00:00Z',
};

async function main() {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://placeholder.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'placeholder-anon-key';
  installPostgrestFake({
    kc_categories: [CATEGORY as unknown as Record<string, unknown>],
    kc_articles: [ARTICLE as unknown as Record<string, unknown>],
    kc_related: [1, 2, 3].map((i) => ({
      article_id: 'art-ab',
      related_id: `rel-${i}`,
      sort_order: i,
      kc_articles: {
        id: `rel-${i}`,
        slug: `related-${i}`,
        title: `A related Knowledge Center guide number ${i}`,
        excerpt: null,
        category_id: CATEGORY.id,
        reading_time_min: 5,
        published_at: '2026-08-01T00:00:00Z',
      },
    })) as unknown as Record<string, unknown>[],
  });

  // The visual is registered in the repository now, so the bench renders the
  // real production state rather than injecting a spec. Fail loudly if it is
  // ever missing: a figure-less page would otherwise sail through as a
  // timeout in the browser bench, which is a confusing way to learn that the
  // registry entry regressed.
  if (!Object.hasOwn(ARTICLE_VISUALS, KEY)) {
    throw new Error(`kc-article-visual-page: no registered visual for ${KEY}`);
  }
  const tree = await ArticlePage({
    params: { category: 'getting-your-cdl', slug: 'class-a-vs-class-b-cdl' },
  });
  process.stdout.write(renderToStaticMarkup(tree as React.ReactElement));
}

main();
