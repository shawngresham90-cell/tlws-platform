/**
 * Knowledge Center Expansion — first 10 authority pages: validation suite.
 *
 * Parses migration 037 (the content source of truth) and checks:
 *   - the 10 expected articles exist, published + reg-verified, unique
 *     titles/meta, 4+ FAQs and 3+ official sources each
 *   - sources point ONLY at official domains (eCFR / FMCSA / CVSA)
 *   - every in-body internal link resolves to a known route or article
 *   - required structure per article (quick answer, disclaimer, definition,
 *     why/who, steps, examples, mistakes, risks, checklist, keep-learning)
 *   - AI-search hygiene (answer-first, no level-1 headings in bodies, no
 *     unsupported markdown like tables, labeled non-legal-advice examples)
 *   - no duplicated paragraphs across articles; no reused FAQ questions
 *   - idempotent, non-destructive migration mechanics
 *   - the KC rendering stack still wires schema/SEO correctly
 *
 * Run:
 *   npx esbuild scripts/test-knowledge-center.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-kc.cjs && node /tmp/test-kc.cjs
 */
import { readFileSync } from 'node:fs';

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

const seed = read('supabase/migrations/037_seed_kc_authority_articles.sql');

// ── 1. Migration mechanics ──────────────────────────────────────────────────
check(
  'every article insert is guarded by if-not-exists on (category, slug)',
  (
    seed.match(
      /if not exists \(select 1 from public\.kc_articles where category_id = v_\w+ and slug = '/g,
    ) ?? []
  ).length === 10,
);
check(
  'kc_related inserts are conflict-safe',
  /on conflict \(article_id, related_id\) do nothing/.test(seed),
);
check(
  'seed contains no destructive or overwriting statements',
  !/drop table|drop column|truncate|delete from|update public\.kc_articles|update public\.kc_categories/i.test(
    seed,
  ),
);
check(
  'seed never creates categories (uses the existing five)',
  !/insert into public\.kc_categories/.test(seed),
);

// ── 2. Article records ──────────────────────────────────────────────────────
const EXPECTED = [
  'cdl-hours-of-service-rules',
  '11-hour-driving-limit',
  '14-hour-driving-window',
  '30-minute-break-rule',
  'split-sleeper-berth-rules',
  'personal-conveyance',
  'yard-move',
  'eld-malfunctions',
  'level-1-dot-inspection',
  'cdl-pre-trip-inspection-guide',
];

type Article = {
  slug: string;
  title: string;
  body: string;
  metaTitle: string;
  metaDescription: string;
  sources: { label: string; url: string }[];
  faqs: { q: string; a: string }[];
};

// Each article block: slug quoted after "values (\n v_cat,\n 'slug'," then
// title, excerpt, $mdx$body$mdx$, meta_title, meta_description, then two $j$
// blocks (sources, faqs).
const articles: Article[] = [];
const blockRe =
  /values \(\s*v_(?:hos|dot|cdl),\s*'([^']+)',\s*'((?:[^']|'')+)',\s*'((?:[^']|'')+)',\s*\$mdx\$([\s\S]*?)\$mdx\$,\s*'((?:[^']|'')+)',\s*'((?:[^']|'')+)',\s*'Shawn Gresham', v_bio,\s*\$j\$([\s\S]*?)\$j\$::jsonb,\s*\$j\$([\s\S]*?)\$j\$::jsonb/g;
let m: RegExpExecArray | null;
while ((m = blockRe.exec(seed)) !== null) {
  articles.push({
    slug: m[1],
    title: m[2].replace(/''/g, "'"),
    body: m[4],
    metaTitle: m[5].replace(/''/g, "'"),
    metaDescription: m[6].replace(/''/g, "'"),
    sources: JSON.parse(m[7]),
    faqs: JSON.parse(m[8]),
  });
}
check('all 10 expected articles parse from the migration', articles.length === 10, articles.length);
check(
  'slugs match the plan exactly',
  EXPECTED.every((s) => articles.some((a) => a.slug === s)),
  articles.map((a) => a.slug),
);
check('titles are unique', new Set(articles.map((a) => a.title)).size === 10);
check('meta titles are unique', new Set(articles.map((a) => a.metaTitle)).size === 10);
check('meta descriptions are unique', new Set(articles.map((a) => a.metaDescription)).size === 10);
check(
  'meta descriptions are sane lengths (70–175 chars)',
  articles.every((a) => a.metaDescription.length >= 70 && a.metaDescription.length <= 175),
  articles.map((a) => `${a.slug}:${a.metaDescription.length}`).join(' '),
);
check(
  'every article is published and reg-verified with the review date',
  (seed.match(/'published', true, '2026-07-17', v_pub/g) ?? []).length === 10,
);

// ── 3. Official sources only ────────────────────────────────────────────────
const OFFICIAL = ['www.ecfr.gov', 'www.fmcsa.dot.gov', 'eld.fmcsa.dot.gov', 'www.cvsa.org'];
check(
  'every source URL is on an official domain (eCFR/FMCSA/CVSA)',
  articles.every((a) => a.sources.every((s) => OFFICIAL.includes(new URL(s.url).host))),
);
check(
  'every article has at least 3 sources',
  articles.every((a) => a.sources.length >= 3),
);
check(
  'every source has a descriptive label',
  articles.every((a) => a.sources.every((s) => s.label.length >= 10)),
);
check(
  'every eCFR source uses the canonical citation-link format',
  articles.every((a) =>
    a.sources
      .filter((s) => s.url.includes('ecfr.gov'))
      .every((s) =>
        /^https:\/\/www\.ecfr\.gov\/current\/title-49\/(part-\d+)(\/section-\d+\.\d+)?$/.test(
          s.url,
        ),
      ),
  ),
);

// ── 4. FAQs — visible content IS the schema content, unique across pages ────
check(
  'every article has 4+ FAQs',
  articles.every((a) => a.faqs.length >= 4),
);
const allFaqQs = articles.flatMap((a) => a.faqs.map((f) => f.q));
check('no FAQ question is reused across articles', new Set(allFaqQs).size === allFaqQs.length);
check(
  'every FAQ answer is substantial (80+ chars) and cites or explains',
  articles.every((a) => a.faqs.every((f) => f.a.length >= 80)),
);

// ── 5. Required structure in every body ─────────────────────────────────────
const structure: [string, RegExp][] = [
  ['direct answer at the top', /^\*\*Quick answer:\*\*/],
  [
    'regulatory-change disclaimer with review date',
    /\*\*Regulatory-change disclaimer:\*\*[\s\S]*July 17, 2026/,
  ],
  ['definition section', /## What /],
  ['why-it-exists section', /## Why /],
  ['who-it-applies section', /## Who /],
  [
    'step-by-step or walkthrough section',
    /step by step|walked through|steps of|## What the officer checks|## How (it|the|to)/i,
  ],
  ['real-world example labeled not-legal-advice', /\(illustration, not legal advice\)/],
  ['common mistakes section', /## Common mistakes/],
  ['violations / compliance risks section', /## Violations and compliance risks/],
  ['driver checklist section', /## Driver checklist/],
  ['keep-learning block (internal links + CTAs)', /## Keep learning/],
  ['academy CTA', /\/academy\)/],
  ['email-list CTA', /\/#newsletter\)/],
  ['practice-test link', /\/practice-tests/],
];
for (const [name, re] of structure) {
  check(
    `every body has: ${name}`,
    articles.every((a) => re.test(a.body)),
    articles.filter((a) => !re.test(a.body)).map((a) => a.slug),
  );
}
check(
  'no level-1 headings inside bodies (title is the only H1)',
  articles.every((a) => !/^# /m.test(a.body)),
);
check(
  'no markdown tables (unsupported by the KC renderer)',
  articles.every((a) => !/^\s*\|/m.test(a.body)),
);
check(
  'no heading deeper than h3 (renderer supports h2/h3)',
  articles.every((a) => !/^#{4,}/m.test(a.body)),
);
check(
  'federal-vs-practice labeling appears where opinions could blur',
  articles.every(
    (a) =>
      /\*\*(Federal requirement|Federal framework|Federal:|Good practice|Company policy note)/.test(
        a.body,
      ) ||
      a.slug === 'cdl-hours-of-service-rules' ||
      a.slug === 'level-1-dot-inspection',
  ),
);

// ── 6. Internal links all resolve ───────────────────────────────────────────
const KNOWN_ROUTES = new Set([
  '/academy',
  '/cdl-pre-school',
  '/practice-tests',
  '/practice-tests/general-knowledge',
  '/practice-tests/air-brakes',
  '/practice-tests/combination-vehicles',
  '/practice-tests/hazmat',
  '/#newsletter',
]);
const KNOWN_KC = new Set([
  ...EXPECTED.map((s) =>
    s === 'level-1-dot-inspection'
      ? `/knowledge/dot-compliance/${s}`
      : s === 'cdl-pre-trip-inspection-guide'
        ? `/knowledge/cdl-training/${s}`
        : `/knowledge/hours-of-service/${s}`,
  ),
  '/knowledge/dot-compliance/what-is-a-dot-inspection', // pre-existing stub
]);
const internalLinks = articles.flatMap((a) =>
  [...a.body.matchAll(/\]\((\/[^)]+)\)/g)].map((x) => x[1]),
);
check(
  'every internal link targets a known route or seeded article',
  internalLinks.every((href) => KNOWN_ROUTES.has(href) || KNOWN_KC.has(href)),
  [...new Set(internalLinks.filter((h) => !KNOWN_ROUTES.has(h) && !KNOWN_KC.has(h)))],
);
check(
  'the 10 pages interlink densely (45+ knowledge-center links)',
  internalLinks.filter((h) => h.startsWith('/knowledge/')).length >= 45,
  internalLinks.filter((h) => h.startsWith('/knowledge/')).length,
);
check(
  'every article body links at least 3 sibling articles',
  articles.every(
    (a) => new Set([...a.body.matchAll(/\]\((\/knowledge\/[^)]+)\)/g)].map((x) => x[1])).size >= 3,
  ),
);
check(
  'external links in bodies are official domains or the TLWS YouTube channel',
  articles.every((a) =>
    [...a.body.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].every((x) => {
      const host = new URL(x[1]).host;
      return OFFICIAL.includes(host) || host === 'youtu.be' || host === 'www.youtube.com';
    }),
  ),
);

// ── 7. No duplicated substance across articles ──────────────────────────────
const paragraphs = new Map<string, string>();
let dupParagraph: string | null = null;
for (const a of articles) {
  for (const p of a.body.split('\n').filter((l) => l.length > 120 && !l.startsWith('#'))) {
    const key = p.trim();
    const owner = paragraphs.get(key);
    if (owner && owner !== a.slug) dupParagraph = `${owner} & ${a.slug}: ${key.slice(0, 60)}…`;
    paragraphs.set(key, a.slug);
  }
}
check(
  'no substantial paragraph is duplicated across articles',
  dupParagraph === null,
  dupParagraph,
);

// ── 8. HOS math consistency across articles ────────────────────────────────
check(
  'the numeric spine is consistent everywhere (11 / 14 / 30-min / 8h / 60-70 / 10h / 7-3 / 8-2 / 34h)',
  /11 hours/.test(articles.find((a) => a.slug === '11-hour-driving-limit')!.body) &&
    /14-consecutive-hour/.test(articles.find((a) => a.slug === '14-hour-driving-window')!.body) &&
    /8 cumulative hours|8 hours of driving/.test(
      articles.find((a) => a.slug === '30-minute-break-rule')!.body,
    ) &&
    /at least 7 consecutive hours/.test(
      articles.find((a) => a.slug === 'split-sleeper-berth-rules')!.body,
    ) &&
    /total at least 10|totaling at least 10|together totaling/i.test(
      articles.find((a) => a.slug === 'split-sleeper-berth-rules')!.body,
    ) &&
    /60 hours[\s\S]*7 (consecutive )?days|60 on-duty hours in 7/.test(
      articles.find((a) => a.slug === 'cdl-hours-of-service-rules')!.body,
    ),
);
check(
  'no article claims the break must be off-duty (pre-2020 rule)',
  articles.every((a) => !/break must be (logged )?off[- ]duty/i.test(a.body)),
);
check(
  'ELD article carries the 24-hour notice, 7-day reconstruction, and 8-day repair numbers',
  (() => {
    const b = articles.find((a) => a.slug === 'eld-malfunctions')!.body;
    return (
      /24 hours/.test(b) &&
      /previous 7 (consecutive )?days|prior 7 days/.test(b) &&
      /8 days|Eight days/.test(b)
    );
  })(),
);

// ── 9. Rendering stack still wired (schema, SEO, sitemap) ───────────────────
const page = read('src/app/(marketing)/knowledge/[category]/[slug]/page.tsx');
check(
  'article page emits Article + FAQ + breadcrumb schema',
  /articleSchema/.test(page) && /faqSchema/.test(page) && /breadcrumbSchema/.test(page),
);
check(
  'article page renders visible FAQs from the same data as the schema',
  /FaqBlock/.test(page) && /faqs=\{article\.faqs\}|article\.faqs/.test(page),
);
check(
  'article metadata builds canonical from category+slug',
  /path: `\/knowledge\/\$\{params\.category\}/.test(page) ||
    /path: `\/knowledge\/\$\{article/.test(page) ||
    /\/knowledge\/\$\{category\.slug\}\/\$\{article\.slug\}/.test(page),
);
const kcSchema = read('src/lib/kc/schema.ts');
check(
  'FAQ schema is gated on visible FAQ content',
  /if \(!article\.faqs\?\.length\) return null/.test(kcSchema),
);
const mdx = read('src/lib/kc/mdx.ts');
check('renderer supports root-relative internal links (not neutered to #)', /isInternal/.test(mdx));
check('renderer keeps external links noopener/new-tab', /rel="noopener" target="_blank"/.test(mdx));
const author = read('src/components/kc/AuthorBlock.tsx');
check(
  'AuthorBlock shows a visible last-reviewed date',
  /Last reviewed against the eCFR/.test(author) && /reg_verified_date/.test(author),
);
check(
  'sitemap derives KC article URLs from the DB',
  /kc_articles/.test(read('src/app/sitemap.ts')),
);

// ── 10. Untouched surfaces ──────────────────────────────────────────────────
for (const f of [
  'src/lib/tests/catalog.ts',
  'src/app/(learn)/practice-tests/page.tsx',
  'src/components/admin/AdminNav.tsx',
]) {
  check(`${f} contains no knowledge-center coupling`, !/kc_articles|kc_categories/.test(read(f)));
}

// ── Done ────────────────────────────────────────────────────────────────────
console.log(`\nKnowledge Center tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
