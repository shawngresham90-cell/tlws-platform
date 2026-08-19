/**
 * Class A vs Class B decision guide — validation suite (055).
 *
 * One decision-intent Knowledge Center page in the existing getting-your-cdl
 * category: /knowledge/getting-your-cdl/class-a-vs-class-b-cdl. This harness
 * holds the page to the same discipline test-knowledge-center.ts applies to
 * the fifty seeded pages, plus the checks specific to this page's brief
 * (P1–P20 below), without touching that harness or its five files.
 *
 * The publication gates, in the order they appear:
 *   P1  the content pipeline builds (parse → renderMarkdown → metadata)
 *   P2  indexable            P3  canonical correct
 *   P4  title present        P5  description present
 *   P6  exactly one H1       P7  Class A definition source-backed
 *   P8  Class B definition source-backed
 *   P9  B→A ELDT upgrade statement source-backed
 *   P10 real internal URLs only — no claude.ai links anywhere
 *   P11–P13 no ENROLL-LINK / ACADEMY-PHONE / ACADEMY-EMAIL placeholders
 *   P14 no DDS/TPR licensed-certified-approved school claim
 *   P15 no opening date      P16 no prices
 *   P17 no first-person experience claims
 *   P18 Academy CTA → canonical /academy
 *   P19 structured data parses
 *   P20 the comparison is list-built (renderer-safe, wraps on mobile)
 * plus: cannibalization guards against cdl-classes-compared, corpus-wide
 * uniqueness (titles/metas/FAQs/paragraphs vs all 50), migration mechanics
 * (guarded insert, conflict-safe kc_related, three guarded replace-based
 * cross-link UPDATEs whose targets must exist exactly once in the EFFECTIVE
 * post-042/045 bodies), and link-density rules on every touched body.
 *
 * Run:
 *   npx esbuild scripts/test-kc-class-a-vs-b.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --alias:next/headers=./scripts/shims/next-headers.ts \
 *     --alias:next/cache=./scripts/shims/next-cache.ts \
 *     --loader:.css=empty \
 *     --outfile=/tmp/test-kc-ab.cjs && node /tmp/test-kc-ab.cjs
 */
import { readFileSync } from 'node:fs';
import type { Metadata } from 'next';
import { renderMarkdown } from '@/lib/kc/mdx';
import { articleSchema, faqSchema } from '@/lib/kc/schema';
import { jsonLdPayload, breadcrumbSchema } from '@/lib/seo/schema';
import { SITE } from '@/lib/seo/site';
import type { KcArticle, KcCategory } from '@/lib/kc/types';
import { generateMetadata as kcArticleMetadata } from '@/app/(marketing)/knowledge/[category]/[slug]/page';
import { installPostgrestFake } from './helpers/postgrest-fake';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};
const read = (p: string) => readFileSync(p, 'utf8');

const seed = read('supabase/migrations/055_seed_kc_class_a_vs_class_b.sql');
const oldSeeds = [
  read('supabase/migrations/037_seed_kc_authority_articles.sql'),
  read('supabase/migrations/038_seed_kc_dot_compliance_articles.sql'),
  read('supabase/migrations/040_seed_kc_getting_your_cdl_articles.sql'),
  read('supabase/migrations/042_seed_kc_careers_money_articles.sql'),
  read('supabase/migrations/045_seed_kc_dot_medical_articles.sql'),
];

const SLUG = 'class-a-vs-class-b-cdl';
const PATH = `/knowledge/getting-your-cdl/${SLUG}`;

// ── 1. Migration mechanics ──────────────────────────────────────────────────
const guardRe =
  /if not exists \(select 1 from public\.kc_articles where category_id = v_\w+ and slug = '/g;
check('055: exactly one guarded insert', (seed.match(guardRe) ?? []).length === 1);
check('055: never creates categories', !/insert into public\.kc_categories/.test(seed));
check('055: never alters categories', !/update public\.kc_categories/.test(seed));
check(
  '055: looks up getting-your-cdl and raises if the category is missing',
  /select id into v_gyc from public\.kc_categories where slug = 'getting-your-cdl'/.test(seed) &&
    /raise exception 'Knowledge Center categories missing/.test(seed),
);
check(
  '055: kc_related inserts are conflict-safe',
  /on conflict \(article_id, related_id\) do nothing/.test(seed),
);
check(
  '055: nothing destructive (no drop/truncate/delete)',
  !/drop table|drop column|truncate|delete from/i.test(seed),
);
const crossLinkUpdates = seed.match(/update public\.kc_articles a set body_mdx = replace\(/g) ?? [];
check('055: exactly three inbound-link UPDATEs, all replace-based', crossLinkUpdates.length === 3);
check(
  '055: no other UPDATE statements of any kind',
  (seed.match(/update public\./g) ?? []).length === 3,
);
check(
  '055: UPDATEs touch body_mdx only — titles and metadata of older pages stay theirs',
  !/set\s+(title|meta_title|meta_description|excerpt|slug|status)\s*=/i.test(seed),
);
check(
  '055: every UPDATE is presence-guarded AND absence-guarded (idempotent)',
  (seed.match(/and a\.body_mdx like '%/g) ?? []).length === 3 &&
    (
      seed.match(
        /and a\.body_mdx not like '%\/knowledge\/getting-your-cdl\/class-a-vs-class-b-cdl%'/g,
      ) ?? []
    ).length === 3,
);
check(
  '055: UPDATEs are slug-scoped to the three intended articles, all in getting-your-cdl',
  /a\.slug = 'cdl-classes-compared'/.test(seed) &&
    /a\.slug = 'how-to-get-your-cdl'/.test(seed) &&
    /a\.slug = 'eldt-requirements'/.test(seed) &&
    (seed.match(/and c\.slug = 'getting-your-cdl'/g) ?? []).length === 3,
);

// ── 2. Parse the new article + the fifty existing ones ─────────────────────
type Parsed = {
  slug: string;
  title: string;
  excerpt: string;
  body: string;
  metaTitle: string;
  metaDescription: string;
  sources: { label: string; url: string }[];
  faqs: { q: string; a: string }[];
};
const blockRe =
  /values \(\s*v_(?:hos|dot|cdl|gyc|car|med),\s*'([^']+)',\s*'((?:[^']|'')+)',\s*'((?:[^']|'')+)',\s*\$mdx\$([\s\S]*?)\$mdx\$,\s*'((?:[^']|'')+)',\s*'((?:[^']|'')+)',\s*'Shawn Gresham', v_bio,\s*\$j\$([\s\S]*?)\$j\$::jsonb,\s*\$j\$([\s\S]*?)\$j\$::jsonb/g;
const parseSeed = (s: string): Parsed[] => {
  const out: Parsed[] = [];
  let m: RegExpExecArray | null;
  blockRe.lastIndex = 0;
  while ((m = blockRe.exec(s)) !== null) {
    out.push({
      slug: m[1],
      title: m[2].replace(/''/g, "'"),
      excerpt: m[3].replace(/''/g, "'"),
      body: m[4],
      metaTitle: m[5].replace(/''/g, "'"),
      metaDescription: m[6].replace(/''/g, "'"),
      sources: JSON.parse(m[7]),
      faqs: JSON.parse(m[8]),
    });
  }
  return out;
};
const mine = parseSeed(seed);
check('P1a: the new article parses out of the migration', mine.length === 1, mine.length);
const art = mine[0];
check('P1b: slug is the stable identifier', art.slug === SLUG, art.slug);
const corpus = oldSeeds.flatMap(parseSeed);
check('the fifty existing articles still parse for corpus checks', corpus.length === 50);

// Effective post-migration text for the three UPDATE targets: 042 and 045
// each carry a replace() into 'how-to-get-your-cdl', so 055's search strings
// are verified against the text production actually holds, not seed-time 040.
const updateRe =
  /replace\(\s*a\.body_mdx,\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)'\)[\s\S]*?a\.slug = '([a-z0-9-]+)'/g;
const extractReplacements = (s: string) => {
  const out: { search: string; replacement: string; slug: string }[] = [];
  let um: RegExpExecArray | null;
  updateRe.lastIndex = 0;
  while ((um = updateRe.exec(s)) !== null) {
    out.push({
      search: um[1].replace(/''/g, "'"),
      replacement: um[2].replace(/''/g, "'"),
      slug: um[3],
    });
  }
  return out;
};
for (const prior of [oldSeeds[2], oldSeeds[3], oldSeeds[4]]) {
  for (const { search, replacement, slug } of extractReplacements(prior)) {
    const target = corpus.find((a) => a.slug === slug);
    if (target && target.body.split(search).length === 2)
      target.body = target.body.replace(search, replacement);
  }
}
const extracted = extractReplacements(seed);
check('055: all three replacement pairs parse from the migration', extracted.length === 3);
for (const { search, replacement, slug } of extracted) {
  const target = corpus.find((a) => a.slug === slug);
  check(
    `055 replacement target text exists exactly once in ${slug} (effective text)`,
    !!target && target.body.split(search).length === 2,
  );
  if (target) target.body = target.body.replace(search, replacement);
  check(
    `055 replacement for ${slug} grows the text and links the new page`,
    replacement.length > search.length && replacement.includes(PATH),
  );
}

// ── 3. P2–P5: metadata through the real page module ─────────────────────────
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
const ARTICLE_ROW: KcArticle = {
  id: 'art-ab',
  slug: art.slug,
  category_id: CATEGORY.id,
  title: art.title,
  excerpt: art.excerpt,
  body_mdx: art.body,
  meta_title: art.metaTitle,
  meta_description: art.metaDescription,
  hero_image_url: null,
  author_name: 'Shawn Gresham',
  author_bio:
    'CDL-A driver and instructor — 17 years driving, zero violations. Founder of Trucking Life with Shawn and the TLWS truck driving school in Dalton, Georgia.',
  sources: art.sources,
  faqs: art.faqs,
  tags: ['getting-your-cdl', 'cdl-classes', 'class-a', 'class-b', 'upgrade', 'georgia'],
  reading_time_min: 8,
  featured: false,
  reg_verified: true,
  reg_verified_date: '2026-08-19',
  published_at: '2026-08-19T15:00:00Z',
  updated_at: '2026-08-19T15:00:00Z',
};

async function metadataChecks() {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://placeholder.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'placeholder-anon-key';
  installPostgrestFake({
    kc_categories: [CATEGORY as unknown as Record<string, unknown>],
    kc_articles: [ARTICLE_ROW as unknown as Record<string, unknown>],
  });
  const meta: Metadata = await kcArticleMetadata({
    params: { category: 'getting-your-cdl', slug: SLUG },
  });
  const title = typeof meta.title === 'string' ? meta.title : '';
  const canonical = typeof meta.alternates?.canonical === 'string' ? meta.alternates.canonical : '';
  const robots = meta.robots as { index?: boolean; follow?: boolean } | undefined;
  check('P1c: the real page module produces metadata for the seeded row', title.length > 0);
  check(
    'P2: the page is indexable (index + follow)',
    robots?.index === true && robots?.follow === true,
  );
  check('P3: canonical is the article URL', canonical === `${SITE.url}${PATH}`, canonical);
  check('P3b: og:url agrees with the canonical', meta.openGraph?.url === canonical);
  check('P4: title present and equals the seeded meta title', title === art.metaTitle);
  check(
    'P5: description present and equals the seeded meta description',
    meta.description === art.metaDescription,
  );
  check(
    'P5b: openGraph type is article',
    (meta.openGraph as { type?: string })?.type === 'article',
  );
}

// ── 4. P6 + P20: the rendered body ──────────────────────────────────────────
const { html, toc } = renderMarkdown(art.body);
check('P1d: the renderer produces a TOC with the major sections', toc.length >= 8, toc.length);
check('P6a: body adds no <h1> — the page template owns the single H1', !/<h1/i.test(html));
check('P6b: no level-1 markdown headings in the body', !/^# /m.test(art.body));
check('P6c: no headings deeper than h3', !/^#{4,}/m.test(art.body));
const pageSrc = read('src/app/(marketing)/knowledge/[category]/[slug]/page.tsx');
check(
  'P6d: the article template renders exactly one h1, from article.title',
  (pageSrc.match(/<h1/g) ?? []).length === 1 && /<h1[^>]*>\{article\.title\}<\/h1>/.test(pageSrc),
);

check(
  'P20a: the at-a-glance comparison section exists',
  /## Class A vs Class B at a glance/.test(art.body),
);
const glance = art.body.split('## Class A vs Class B at a glance')[1]?.split(/^## /m)[0] ?? '';
const glanceRows = glance.split('\n').filter((l) => /^- \*\*[^*]+:\*\*/.test(l));
check(
  'P20b: the comparison has 5+ bold-labeled list rows',
  glanceRows.length >= 5,
  glanceRows.length,
);
check('P20c: no markdown tables anywhere (renderer prints pipes raw)', !/^\s*\|/m.test(art.body));
check(
  'P20d: comparison rows renderer-safe — no raw URLs or unbreakable tokens',
  glanceRows.every((r) => !/https?:\/\//.test(r) && r.split(/\s+/).every((w) => w.length <= 30)),
);
check(
  'P20e: the comparison renders as a list (wraps on mobile, no overflow container needed)',
  /<ul[^>]*>/.test(renderMarkdown(glance).html) && !/<table/i.test(html),
);

// ── 5. P7–P9: the load-bearing regulatory statements, source-backed ─────────
const srcUrls = art.sources.map((s) => s.url);
check(
  'P7a: Class A definition carries both thresholds in the body',
  /26,001 pounds or more/.test(art.body) && /over 10,000 pounds/.test(art.body),
);
check(
  'P7b: Class A definition cites 383.91 inline and in sources',
  art.body.includes('https://www.ecfr.gov/current/title-49/part-383/section-383.91') &&
    srcUrls.includes('https://www.ecfr.gov/current/title-49/part-383/section-383.91'),
);
check(
  'P7c: the GCWR rating-vs-actual mechanics cite 383.5',
  art.body.includes('https://www.ecfr.gov/current/title-49/part-383/section-383.5') &&
    srcUrls.includes('https://www.ecfr.gov/current/title-49/part-383/section-383.5'),
);
check(
  'P8a: Class B definition states the single-vehicle + towed ceiling in the body',
  /single vehicle/i.test(art.body) && /10,000 pounds or less/.test(art.body),
);
check(
  'P8b: the Georgia class table backs the state-mirror claim',
  art.body.includes('https://dds.georgia.gov/license-classes') &&
    srcUrls.includes('https://dds.georgia.gov/license-classes'),
);
check(
  'P9a: the B-to-A upgrade ELDT statement is dated and unambiguous',
  /February 7, 2022/.test(art.body) &&
    /upgrad\w+ (from Class B )?to Class A to complete ELDT|Class B holder upgrading to Class A to complete ELDT/i.test(
      art.body,
    ),
);
check(
  'P9b: the ELDT statement cites Part 380 and the TPR, inline and in sources',
  art.body.includes('https://www.ecfr.gov/current/title-49/part-380') &&
    art.body.includes('https://tpr.fmcsa.dot.gov/') &&
    srcUrls.includes('https://www.ecfr.gov/current/title-49/part-380') &&
    srcUrls.includes('https://tpr.fmcsa.dot.gov/'),
);
check(
  'P9c: the upgrade FAQ answers ELDT with the same facts',
  art.faqs.some(
    (f) => /upgrad/i.test(f.q) && /ELDT/i.test(f.q + f.a) && /February 7, 2022/.test(f.a),
  ),
);
check(
  'sources: 3+ entries, labels substantial',
  art.sources.length >= 3 && art.sources.every((s) => s.label.length >= 10),
);
const OFFICIAL_HOSTS = [
  'www.ecfr.gov',
  'www.fmcsa.dot.gov',
  'tpr.fmcsa.dot.gov',
  'dds.georgia.gov',
];
check(
  'sources: official domains only (eCFR / FMCSA / TPR / Georgia DDS)',
  art.sources.every((s) => OFFICIAL_HOSTS.includes(new URL(s.url).host)),
  art.sources.map((s) => new URL(s.url).host),
);
check(
  'sources: every eCFR citation uses the canonical current-title format',
  art.sources
    .filter((s) => s.url.includes('ecfr.gov'))
    .every((s) =>
      /^https:\/\/www\.ecfr\.gov\/current\/title-49\/(part-\d+)(\/section-\d+\.\d+)?$/.test(s.url),
    ),
);

// ── 6. P10–P18: link hygiene and claim gates ────────────────────────────────
check('P10a: no claude.ai URL anywhere in the migration', !/claude\.ai/i.test(seed));
const KNOWN_ROUTES = new Set([
  '/academy',
  '/cdl-pre-school',
  '/practice-tests',
  '/practice-tests/general-knowledge',
  '/practice-tests/air-brakes',
  '/practice-tests/combination-vehicles',
  '/practice-tests/hazmat',
  '/practice-tests/tanker',
  '/#newsletter',
]);
const CAT_OF: Record<string, string> = {};
for (const s of [
  'how-to-get-your-cdl',
  'cdl-requirements',
  'cdl-permit-explained',
  'eldt-requirements',
  'cdl-classes-compared',
  'cdl-endorsements-restrictions',
  'cdl-skills-test',
  'cdl-cost',
  'sponsored-vs-private-cdl-school',
  'cdl-study-plan',
])
  CAT_OF[s] = 'getting-your-cdl';
for (const s of [
  'cdl-truck-driver-pay',
  'otr-vs-regional-vs-local',
  'company-driver-pay',
  'owner-operator-vs-company-driver',
  'what-is-a-good-cpm-rate',
  'trucking-benefits-and-per-diem',
  'how-to-read-a-settlement-statement',
  'lease-purchase-programs-explained',
  'home-time-and-quality-of-life',
  'trucking-career-paths',
])
  CAT_OF[s] = 'trucking-careers';
const KNOWN_KC = new Set([
  ...Object.entries(CAT_OF).map(([slug, cat]) => `/knowledge/${cat}/${slug}`),
  PATH,
]);
const internalLinks = [...art.body.matchAll(/\]\((\/[^)]+)\)/g)].map((x) => x[1]);
check(
  'P10b: every internal link resolves to a known route or seeded article',
  internalLinks.every((href) => KNOWN_ROUTES.has(href) || KNOWN_KC.has(href)),
  internalLinks.filter((href) => !KNOWN_ROUTES.has(href) && !KNOWN_KC.has(href)),
);
check(
  'P10c: external body links are official domains only',
  [...art.body.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].every((x) =>
    OFFICIAL_HOSTS.includes(new URL(x[1]).host),
  ),
);
check('P10d: the new page never links itself', !art.body.includes(`](${PATH})`));
const kcLinkCounts = new Map<string, number>();
for (const x of art.body.matchAll(/\]\((\/knowledge\/[^)#]+)\)/g))
  kcLinkCounts.set(x[1], (kcLinkCounts.get(x[1]) ?? 0) + 1);
check(
  'link density: 3+ distinct sibling KC links, none more than twice',
  kcLinkCounts.size >= 3 && [...kcLinkCounts.values()].every((n) => n <= 2),
  Object.fromEntries(kcLinkCounts),
);
check(
  'link density: the cluster pillar is linked',
  art.body.includes('/knowledge/getting-your-cdl/how-to-get-your-cdl'),
);
for (const slug of ['cdl-classes-compared', 'how-to-get-your-cdl', 'eldt-requirements']) {
  const body = corpus.find((a) => a.slug === slug)!.body;
  const counts = new Map<string, number>();
  for (const x of body.matchAll(/\]\((\/knowledge\/[^)#]+)\)/g))
    counts.set(x[1], (counts.get(x[1]) ?? 0) + 1);
  check(
    `cross-linked ${slug} still respects the 2-per-target rule after 055`,
    [...counts.values()].every((n) => n <= 2),
    [...counts.entries()].filter(([, n]) => n > 2),
  );
}

for (const [gate, needle] of [
  ['P11: no ENROLL-LINK placeholder', 'ENROLL-LINK'],
  ['P12: no ACADEMY-PHONE placeholder', 'ACADEMY-PHONE'],
  ['P13: no ACADEMY-EMAIL placeholder', 'ACADEMY-EMAIL'],
] as const) {
  check(gate, !seed.toUpperCase().includes(needle));
}
check(
  'P11b: no editorial placeholders survive anywhere in the migration',
  !/\bTODO\b|\bTBD\b|\bFIXME\b|\bXXX\b|PLACEHOLDER/i.test(seed),
);
check(
  'P11c: no phone number pattern anywhere in the migration',
  !/\(\d{3}\) ?\d{3}[- ]\d{4}|\b\d{3}-\d{3}-\d{4}\b/.test(seed),
);
check(
  'P11d: no email address in the article (none is established)',
  !/[\w.+-]+@[\w-]+\.[\w.]+/.test(art.body + JSON.stringify(art.faqs)),
);

const claimText = art.body + ' ' + JSON.stringify(art.faqs) + ' ' + art.excerpt;
check(
  'P14a: no licensed/certified/approved/registered school-status claim',
  !/(licensed|certified|approved|registered)[^.\n]{0,60}(CDL school|academy|training school)/i.test(
    claimText,
  ) && !/(DDS|state)[- ](licensed|certified|approved)/i.test(claimText),
);
check(
  'P14b: the Academy is asserted to exist, nothing more',
  !/Trucking Life Academy[^.\n]{0,80}(licensed|certified|approved|registered|listed|opens|enroll)/i.test(
    claimText,
  ),
);
check(
  'P14c: TPR references are generic regulatory statements, never an Academy listing claim',
  !/(Academy|our school|the school)[^.\n]{0,60}(Training Provider Registry|TPR)/i.test(claimText),
);
check(
  'P15a: no enrollment/opening date attached to any month or day',
  !/(opens?|opening|starts?|starting|begins?|beginning|enroll\w*)[^.\n]{0,40}(January|February|March|April|May|June|July|August|September|October|November|December|20\d\d)/i.test(
    claimText,
  ),
);
check('P15b: the draft opening date never appears', !/October 18/i.test(seed));
check(
  'P15c: the only day-precision dates are regulatory effective dates or the review stamp',
  (
    seed.match(
      /(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}/g,
    ) ?? []
  ).every((d) => ['February 7, 2022', 'June 18, 2025', 'August 19, 2026'].includes(d)),
  seed.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}/g,
  ),
);
check('P16: no dollar amounts anywhere (no tuition, no pay figures)', !/\$\s?\.?\d/.test(seed));
check(
  'P16b: no salary/pass-rate/placement claims',
  !/average (salary|pay)|\d+% pass rate|placement rate|\d+\s?(cpm|cents per mile)/i.test(claimText),
);
check(
  'P17: no first-person experience claims (the draft anecdote stays out)',
  !/\bEvery year I\b|\bI meet\b|\bmy students\b|\bI've\b|\bI'm\b|\bI have seen\b/i.test(
    claimText,
  ) && !/(^|[.!?]\s+)I\s/m.test(art.body),
);
check(
  'opinion is labeled as recommendation, not regulation',
  /Recommendation, not a federal requirement/.test(art.body),
);
check(
  'P18a: the Academy CTA links the canonical hub exactly once',
  (art.body.match(/\]\(\/academy\)/g) ?? []).length === 1 &&
    art.body.includes('[Trucking Life Academy](/academy)'),
);
check(
  'P18b: the CTA never routes to the local-SEO satellite',
  !art.body.includes('/academy/cdl-school-dalton-ga'),
);
check(
  'P18c: the CTA line carries no urgency, dates, or prices',
  (() => {
    const cta = art.body.split('\n').find((l) => l.includes('](/academy)')) ?? '';
    return (
      cta.length > 0 &&
      !/(hurry|limited|only \d|spots|deadline|now open|enrolling)/i.test(cta) &&
      !/(January|February|March|April|May|June|July|August|September|October|November|December|20\d\d)/.test(
        cta,
      )
    );
  })(),
);

// ── 7. P19: structured data parses ──────────────────────────────────────────
const url = `${SITE.url}${PATH}`;
const schemas = [
  breadcrumbSchema([
    { name: 'Home', path: '/' },
    { name: 'Knowledge Center', path: '/knowledge' },
    { name: CATEGORY.name, path: `/knowledge/${CATEGORY.slug}` },
    { name: ARTICLE_ROW.title, path: PATH },
  ]),
  articleSchema(ARTICLE_ROW, CATEGORY, url),
  faqSchema(ARTICLE_ROW),
].filter(Boolean);
check('P19a: Article + FAQPage + BreadcrumbList all build', schemas.length === 3);
let parsedPayload: unknown[] = [];
try {
  parsedPayload = JSON.parse(jsonLdPayload(schemas as object[]));
} catch {
  parsedPayload = [];
}
check('P19b: the JSON-LD payload round-trips through JSON.parse', parsedPayload.length === 3);
const faqNode = parsedPayload.find((n) => (n as { '@type'?: string })['@type'] === 'FAQPage') as
  | { mainEntity?: unknown[] }
  | undefined;
check(
  'P19c: FAQPage mirrors the visible FAQ block one-to-one',
  faqNode?.mainEntity?.length === art.faqs.length,
);
check(
  'P19d: the article page still wires schema + visible FAQs (FaqBlock)',
  /articleSchema/.test(pageSrc) && /faqSchema/.test(pageSrc) && /FaqBlock/.test(pageSrc),
);
check(
  'P19e: no schema field serializes null/undefined',
  !jsonLdPayload(schemas as object[]).includes('null') &&
    !jsonLdPayload(schemas as object[]).includes('undefined'),
);

// ── 8. House structure, lengths, and corpus-wide uniqueness ─────────────────
const structure: [string, RegExp][] = [
  ['quick answer at the top', /^\*\*Quick answer:\*\*/],
  [
    'regulatory-change disclaimer with the review date',
    /\*\*Regulatory-change disclaimer:\*\*[\s\S]*August 19, 2026/,
  ],
  ['who-this-faces section', /## Who this decision faces/],
  [
    'definition sections for both classes',
    /## What a Class A CDL is[\s\S]*## What a Class B CDL is/,
  ],
  ['jobs section', /## The jobs each license supports/],
  [
    'when-A and when-B decision sections',
    /## When Class A makes sense[\s\S]*## When Class B makes sense/,
  ],
  ['upgrade section', /## Upgrading from Class B to Class A/],
  [
    'Georgia section with ordered steps',
    /## Getting a Class A or Class B CDL in Georgia[\s\S]*The Georgia steps, in order/,
  ],
  ['labeled illustration', /\(illustration, not career advice\)/],
  ['common mistakes section', /## Common mistakes/],
  ['decision checklist section', /## Your decision checklist/],
  ['keep-learning block', /## Keep learning/],
  ['pre-school CTA', /\/cdl-pre-school\)/],
  ['email-list CTA', /\/#newsletter\)/],
  ['practice-test link', /\/practice-tests/],
  ['federal vs state distinction', /[Ff]ederal[\s\S]*Georgia/],
  ['the 14-day CLP floor', /14 days|14-day/],
];
for (const [name, re] of structure) check(`body has: ${name}`, re.test(art.body));
check(
  'Georgia material stays in the Georgia section and CTA (no Dalton stuffing)',
  (() => {
    const beforeGeorgia = art.body.split('## Getting a Class A or Class B CDL in Georgia')[0];
    return !/Dalton/i.test(beforeGeorgia) && (art.body.match(/Dalton/g) ?? []).length <= 1;
  })(),
);
check(
  'medical language is conditional, the Georgia way',
  /if your operating category requires it/.test(art.body) &&
    !/every (driver|applicant) (must|needs)[^.\n]{0,30}medical/i.test(art.body),
);
check('body uses single apostrophes only (dollar-quoted)', !art.body.includes("''"));
check(
  'excerpt substantial (80–320) with no doubled apostrophe',
  art.excerpt.length >= 80 && art.excerpt.length <= 320 && !art.excerpt.includes("''"),
  art.excerpt.length,
);
check(
  'meta description sane length (70–175)',
  art.metaDescription.length >= 70 && art.metaDescription.length <= 175,
  art.metaDescription.length,
);
check(
  'meta title avoids SERP truncation (≤72 before the brand suffix)',
  art.metaTitle.replace(/ \| Trucking Life with Shawn$/, '').length <= 72,
  art.metaTitle.length,
);
check(
  'H1 is the brief title exactly',
  art.title === 'Class A vs Class B CDL: Which One Should You Get?',
);
check(
  'published + reg-verified with the review date',
  /'published', true, '2026-08-19', v_pub/.test(seed),
);
check(
  '4+ FAQs, every answer substantial',
  art.faqs.length >= 4 && art.faqs.every((f) => f.a.length >= 80),
);
check(
  'FAQ questions unique against all fifty existing pages',
  art.faqs.every((f) => corpus.every((a) => a.faqs.every((g) => g.q !== f.q))),
);
check(
  'title / meta title / excerpt / meta description unique against the corpus',
  corpus.every(
    (a) =>
      a.title !== art.title &&
      a.metaTitle !== art.metaTitle &&
      a.excerpt !== art.excerpt &&
      a.metaDescription !== art.metaDescription,
  ),
);
const corpusParagraphs = new Set(
  corpus
    .flatMap((a) => a.body.split('\n').filter((l) => l.length > 120 && !l.startsWith('#')))
    .map((l) => l.trim()),
);
check(
  'no substantial paragraph duplicated from any existing article',
  art.body
    .split('\n')
    .filter((l) => l.length > 120 && !l.startsWith('#'))
    .every((l) => !corpusParagraphs.has(l.trim())),
);

// ── 9. Cannibalization guards ───────────────────────────────────────────────
const oldClasses = corpus.find((a) => a.slug === 'cdl-classes-compared')!;
check(
  'the taxonomy head term stays with cdl-classes-compared',
  oldClasses.title === 'CDL Classes A, B, and C Compared' &&
    !/Classes A, B,? and C|A, B, C Compared/i.test(art.title + ' ' + art.metaTitle),
);
check(
  'the decision head term stays with the new page',
  /Which One Should You Get/.test(art.title) && !/Which One Should You Get/.test(oldClasses.title),
);
check(
  'the new page defers the three-class taxonomy instead of duplicating it',
  art.body.includes('/knowledge/getting-your-cdl/cdl-classes-compared') &&
    !/## Class C/.test(art.body) &&
    !/16 or more (occupants|passengers)/.test(art.body),
);
check(
  'no FAQ collides with the old page even semantically flagged head question',
  !art.faqs.some((f) => /what is the difference between class a and class b/i.test(f.q)),
);

// ── 10. Async metadata checks, then summary ─────────────────────────────────
metadataChecks()
  .catch((e) => {
    check('metadata checks completed without throwing', false, String(e));
  })
  .finally(() => {
    console.log(`\nClass A vs B page tests: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  });
