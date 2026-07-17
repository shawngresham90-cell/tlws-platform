/**
 * Knowledge Center validation suite — Batch 1 (037, HOS + inspections) and
 * Batch 2 (038, DOT Compliance cluster): 20 authority pages.
 *
 * Checks per batch and across both:
 *   - exact slug sets; unique titles / SEO titles / meta descriptions
 *   - official-domain-only sources in canonical eCFR/FMCSA/CVSA formats
 *   - required structure (quick answer, disclaimer + review date, definition,
 *     why/who, steps, labeled examples, mistakes, risks, checklist,
 *     keep-learning, CTAs, practice-test links)
 *   - every internal link resolves; cross-cluster bridges exist; ≤2 in-body
 *     links per target per article
 *   - FAQ uniqueness across all 20 pages; FAQ answers substantial
 *   - no duplicated substantial paragraphs anywhere
 *   - HOS/compliance number consistency; no unsupported claim patterns
 *   - migration mechanics: guarded inserts, conflict-safe kc_related,
 *     038's two Batch-1 cross-link UPDATEs guarded + idempotent, nothing
 *     destructive anywhere
 *   - the rendering stack still wires schema/SEO correctly
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

const seed1 = read('supabase/migrations/037_seed_kc_authority_articles.sql');
const seed2 = read('supabase/migrations/038_seed_kc_dot_compliance_articles.sql');

// ── 1. Migration mechanics ──────────────────────────────────────────────────
const guardRe =
  /if not exists \(select 1 from public\.kc_articles where category_id = v_\w+ and slug = '/g;
check('037: ten guarded inserts', (seed1.match(guardRe) ?? []).length === 10);
check('038: ten guarded inserts', (seed2.match(guardRe) ?? []).length === 10);
for (const [name, s] of [
  ['037', seed1],
  ['038', seed2],
] as const) {
  check(
    `${name}: kc_related inserts are conflict-safe`,
    /on conflict \(article_id, related_id\) do nothing/.test(s),
  );
  check(
    `${name}: nothing destructive (no drop/truncate/delete)`,
    !/drop table|drop column|truncate|delete from/i.test(s),
  );
  check(`${name}: never creates categories`, !/insert into public\.kc_categories/.test(s));
}
check('037: never updates existing articles', !/update public\.kc_articles/.test(seed1));
const crossLinkUpdates =
  seed2.match(/update public\.kc_articles a set body_mdx = replace\(/g) ?? [];
check('038: exactly three Batch 1 UPDATEs, all replace-based', crossLinkUpdates.length === 3);
check(
  '038: every Batch 1 UPDATE is presence-guarded (idempotent by construction)',
  (seed2.match(/and a\.body_mdx like '%/g) ?? []).length === 3 &&
    (seed2.match(/and a\.body_mdx not like '%\/knowledge\/dot-compliance\//g) ?? []).length === 2,
);
check(
  '038: Batch 1 UPDATEs are slug-scoped',
  /a\.slug = 'cdl-hours-of-service-rules'/.test(seed2) &&
    /a\.slug = 'level-1-dot-inspection'/.test(seed2) &&
    /a\.slug = '11-hour-driving-limit'/.test(seed2),
);

// ── 2. Parse all 20 article records ─────────────────────────────────────────
const BATCH1 = [
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
const BATCH2 = [
  'dot-inspection-levels-compared',
  'cvsa-out-of-service-criteria',
  'dvir-explained',
  'csa-scores-sms-explained',
  'dataqs-disputes',
  'dot-medical-card',
  'drug-alcohol-testing-clearinghouse',
  'cargo-securement-basics',
  'truck-lighting-requirements',
  'annual-dot-inspection',
];
const CAT_OF: Record<string, string> = {};
for (const s of BATCH1)
  CAT_OF[s] =
    s === 'level-1-dot-inspection'
      ? 'dot-compliance'
      : s === 'cdl-pre-trip-inspection-guide'
        ? 'cdl-training'
        : 'hours-of-service';
for (const s of BATCH2) CAT_OF[s] = 'dot-compliance';

type Article = {
  slug: string;
  batch: 1 | 2;
  title: string;
  body: string;
  metaTitle: string;
  metaDescription: string;
  sources: { label: string; url: string }[];
  faqs: { q: string; a: string }[];
};
const blockRe =
  /values \(\s*v_(?:hos|dot|cdl),\s*'([^']+)',\s*'((?:[^']|'')+)',\s*'((?:[^']|'')+)',\s*\$mdx\$([\s\S]*?)\$mdx\$,\s*'((?:[^']|'')+)',\s*'((?:[^']|'')+)',\s*'Shawn Gresham', v_bio,\s*\$j\$([\s\S]*?)\$j\$::jsonb,\s*\$j\$([\s\S]*?)\$j\$::jsonb/g;
const articles: Article[] = [];
for (const [batch, s] of [
  [1, seed1],
  [2, seed2],
] as const) {
  let m: RegExpExecArray | null;
  blockRe.lastIndex = 0;
  while ((m = blockRe.exec(s)) !== null) {
    articles.push({
      slug: m[1],
      batch,
      title: m[2].replace(/''/g, "'"),
      body: m[4],
      metaTitle: m[5].replace(/''/g, "'"),
      metaDescription: m[6].replace(/''/g, "'"),
      sources: JSON.parse(m[7]),
      faqs: JSON.parse(m[8]),
    });
  }
}
// Apply 038's three Batch 1 body replacements so every content check below
// evaluates the EFFECTIVE post-migration text (what production serves).
for (const a of articles) {
  if (a.slug === 'cdl-hours-of-service-rules') {
    a.body = a.body.replace(
      'feed the FMCSA Safety Measurement System scores that follow both driver and carrier',
      'feed the [FMCSA Safety Measurement System](/knowledge/dot-compliance/csa-scores-sms-explained) scores that follow both driver and carrier',
    );
  }
  if (a.slug === 'level-1-dot-inspection') {
    a.body = a.body.replace(
      "The dispute process exists — FMCSA's DataQs system, which drivers as well as carriers can use;",
      "The dispute process exists — [FMCSA's DataQs system](/knowledge/dot-compliance/dataqs-disputes), which drivers as well as carriers can use;",
    );
  }
  if (a.slug === '11-hour-driving-limit') {
    a.body = a.body.replace(
      'burn the window and the [60/70-hour totals](/knowledge/hours-of-service/cdl-hours-of-service-rules) instead',
      'burn the window and the 60/70-hour totals instead',
    );
  }
}
check('all 20 articles parse (10 per batch)', articles.length === 20, articles.length);
check(
  "038's Batch 1 replacements all matched real 037 text (effective content differs)",
  articles
    .find((a) => a.slug === 'cdl-hours-of-service-rules')!
    .body.includes('/knowledge/dot-compliance/csa-scores-sms-explained') &&
    articles
      .find((a) => a.slug === 'level-1-dot-inspection')!
      .body.includes('/knowledge/dot-compliance/dataqs-disputes') &&
    !articles
      .find((a) => a.slug === '11-hour-driving-limit')!
      .body.includes('[60/70-hour totals]('),
);
check(
  'slug sets match the plan exactly',
  BATCH1.every((s) => articles.some((a) => a.slug === s && a.batch === 1)) &&
    BATCH2.every((s) => articles.some((a) => a.slug === s && a.batch === 2)),
);
check('titles unique across 20', new Set(articles.map((a) => a.title)).size === 20);
check('meta titles unique across 20', new Set(articles.map((a) => a.metaTitle)).size === 20);
check(
  'meta descriptions unique across 20',
  new Set(articles.map((a) => a.metaDescription)).size === 20,
);
check(
  'meta descriptions sane length (70–175 chars)',
  articles.every((a) => a.metaDescription.length >= 70 && a.metaDescription.length <= 175),
  articles
    .filter((a) => a.metaDescription.length > 175 || a.metaDescription.length < 70)
    .map((a) => `${a.slug}:${a.metaDescription.length}`),
);
check(
  'meta titles avoid obvious SERP truncation (≤72 chars before brand suffix)',
  articles.every((a) => a.metaTitle.replace(/ \| Trucking Life with Shawn$/, '').length <= 72),
  articles
    .map((a) => [a.slug, a.metaTitle.replace(/ \| Trucking Life with Shawn$/, '').length] as const)
    .filter(([, n]) => n > 72),
);
check(
  'every article published + reg-verified with review date',
  (seed1.match(/'published', true, '2026-07-17', v_pub/g) ?? []).length === 10 &&
    (seed2.match(/'published', true, '2026-07-17', v_pub/g) ?? []).length === 10,
);

// ── 3. Official sources only, canonical formats ─────────────────────────────
const OFFICIAL = [
  'www.ecfr.gov',
  'www.fmcsa.dot.gov',
  'eld.fmcsa.dot.gov',
  'csa.fmcsa.dot.gov',
  'dataqs.fmcsa.dot.gov',
  'clearinghouse.fmcsa.dot.gov',
  'www.cvsa.org',
];
check(
  'every source URL is an official domain',
  articles.every((a) => a.sources.every((s) => OFFICIAL.includes(new URL(s.url).host))),
);
check(
  'every article has 3+ labeled sources',
  articles.every((a) => a.sources.length >= 3 && a.sources.every((s) => s.label.length >= 10)),
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

// ── 4. FAQs unique across all 20 pages ──────────────────────────────────────
check(
  'every article has 4+ FAQs',
  articles.every((a) => a.faqs.length >= 4),
);
const allFaqQs = articles.flatMap((a) => a.faqs.map((f) => f.q));
check('no FAQ question reused across the 20 pages', new Set(allFaqQs).size === allFaqQs.length);
check(
  'every FAQ answer is substantial (80+ chars)',
  articles.every((a) => a.faqs.every((f) => f.a.length >= 80)),
);

// ── 5. Required structure in every body ─────────────────────────────────────
const structure: [string, RegExp][] = [
  ['direct answer at the top', /^\*\*Quick answer:\*\*/],
  ['disclaimer with review date', /\*\*Regulatory-change disclaimer:\*\*[\s\S]*July 17, 2026/],
  ['definition section', /## What /],
  ['why section', /## Why /],
  ['who section', /## Who /],
  [
    'step-by-step or walkthrough section',
    /step by step|walked through|walked around|one by one|- \*\*Step 1|### Step 1|## The .* (levels|test types|lighting map)/i,
  ],
  ['labeled real-world example', /\(illustration, not legal advice\)/],
  ['common mistakes section', /## Common mistakes/],
  ['risks section', /## (Violations and compliance risks|Compliance risks)/],
  ['driver checklist section', /## Driver checklist/],
  ['keep-learning block', /## Keep learning/],
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
  'no level-1 headings inside bodies',
  articles.every((a) => !/^# /m.test(a.body)),
);
check(
  'no markdown tables (unsupported)',
  articles.every((a) => !/^\s*\|/m.test(a.body)),
);
check(
  'no headings deeper than h3',
  articles.every((a) => !/^#{4,}/m.test(a.body)),
);
check(
  'authority labeling present where rules could blur',
  articles.every(
    (a) =>
      /\*\*(Federal requirement|Federal regulation|Federal framework|Federal:|FMCSA process fact|Good practice|Company policy note|State-variation note|Whose rule is what|Not in the standard|One regulatory OOS)/.test(
        a.body,
      ) ||
      [
        'cdl-hours-of-service-rules',
        'level-1-dot-inspection',
        'csa-scores-sms-explained',
        'dataqs-disputes',
      ].includes(a.slug),
  ),
  articles
    .filter(
      (a) =>
        !/\*\*(Federal requirement|Federal regulation|Federal framework|Federal:|FMCSA process fact|Good practice|Company policy note|State-variation note|Whose rule is what|Not in the standard|One regulatory OOS)/.test(
          a.body,
        ),
    )
    .map((a) => a.slug),
);
check(
  'no unsupported-claim patterns (invented fines/statistics)',
  articles.every(
    (a) => !/\$\d{1,3},?\d{0,3} fine|\d+% of (all )?(trucks|drivers|inspections)/i.test(a.body),
  ),
);
check(
  'medical/testing articles avoid outcome-promising language',
  ['dot-medical-card', 'drug-alcohol-testing-clearinghouse'].every((s) => {
    const b = articles.find((a) => a.slug === s)!.body;
    return !/you will qualify|you are disqualified|guaranteed to pass/i.test(b);
  }),
);

// ── 6. Internal links resolve; density and restraint ────────────────────────
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
  ...Object.entries(CAT_OF).map(([slug, cat]) => `/knowledge/${cat}/${slug}`),
  '/knowledge/dot-compliance/what-is-a-dot-inspection',
]);
const allLinks = articles.flatMap((a) =>
  [...a.body.matchAll(/\]\((\/[^)]+)\)/g)].map((x) => ({ from: a.slug, href: x[1] })),
);
check(
  'every internal link targets a known route or seeded article',
  allLinks.every((l) => KNOWN_ROUTES.has(l.href) || KNOWN_KC.has(l.href)),
  [
    ...new Set(
      allLinks.filter((l) => !KNOWN_ROUTES.has(l.href) && !KNOWN_KC.has(l.href)).map((l) => l.href),
    ),
  ],
);
check(
  'every article links 3+ sibling KC articles',
  articles.every(
    (a) => new Set([...a.body.matchAll(/\]\((\/knowledge\/[^)]+)\)/g)].map((x) => x[1])).size >= 3,
  ),
);
check(
  'no article links the same KC target more than twice in-body',
  articles.every((a) => {
    const counts = new Map<string, number>();
    for (const x of a.body.matchAll(/\]\((\/knowledge\/[^)#]+)\)/g))
      counts.set(x[1], (counts.get(x[1]) ?? 0) + 1);
    return [...counts.values()].every((n) => n <= 2);
  }),
  articles
    .map((a) => {
      const counts = new Map<string, number>();
      for (const x of a.body.matchAll(/\]\((\/knowledge\/[^)#]+)\)/g))
        counts.set(x[1], (counts.get(x[1]) ?? 0) + 1);
      const over = [...counts.entries()].filter(([, n]) => n > 2);
      return over.length ? `${a.slug}: ${over.map(([t, n]) => `${t}×${n}`).join(',')}` : null;
    })
    .filter(Boolean),
);
const b2 = (slug: string) => articles.find((a) => a.slug === slug && a.batch === 2)!.body;
check(
  'every Batch 2 spoke links the cluster pillar',
  BATCH2.filter((s) => s !== 'dot-inspection-levels-compared').every((s) =>
    b2(s).includes('/knowledge/dot-compliance/dot-inspection-levels-compared'),
  ),
  BATCH2.filter(
    (s) =>
      s !== 'dot-inspection-levels-compared' &&
      !b2(s).includes('/knowledge/dot-compliance/dot-inspection-levels-compared'),
  ),
);
check(
  'cross-cluster bridges exist (OOS↔HOS, DVIR↔pre-trip, CSA↔DataQs, annual↔pre-trip, securement↔GK test)',
  b2('cvsa-out-of-service-criteria').includes('/knowledge/hours-of-service/') &&
    b2('dvir-explained').includes('/knowledge/cdl-training/cdl-pre-trip-inspection-guide') &&
    b2('csa-scores-sms-explained').includes('/knowledge/dot-compliance/dataqs-disputes') &&
    b2('annual-dot-inspection').includes('/knowledge/cdl-training/cdl-pre-trip-inspection-guide') &&
    b2('cargo-securement-basics').includes('/practice-tests/general-knowledge'),
);
check(
  'external body links are official domains or the TLWS YouTube channel',
  articles.every((a) =>
    [...a.body.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].every((x) => {
      const host = new URL(x[1]).host;
      return OFFICIAL.includes(host) || host === 'youtu.be' || host === 'www.youtube.com';
    }),
  ),
);

// ── 7. No duplicated substance across the 20 articles ───────────────────────
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
check('no substantial paragraph duplicated across articles', dupParagraph === null, dupParagraph);

// ── 8. Number/claim consistency ─────────────────────────────────────────────
const bodyOf = (slug: string) => articles.find((a) => a.slug === slug)!.body;
check(
  'Batch 1 HOS spine intact after Batch 2 (11/14/8h/7-hour split)',
  /11 hours/.test(bodyOf('11-hour-driving-limit')) &&
    /14-consecutive-hour/.test(bodyOf('14-hour-driving-window')) &&
    /8 cumulative hours|8 hours of driving/.test(bodyOf('30-minute-break-rule')) &&
    /at least 7 consecutive hours/.test(bodyOf('split-sleeper-berth-rules')),
);
check(
  'DVIR article: 2014 change, defect-only rule, 3-month retention',
  /2014/.test(bodyOf('dvir-explained')) &&
    /no-defect DVIRs are no longer required|no report is required/.test(bodyOf('dvir-explained')) &&
    /three months/.test(bodyOf('dvir-explained')),
);
check(
  'CSA article: no driver score; PSP 3-year inspections; 24-month window',
  /No public driver CSA score exists/.test(bodyOf('csa-scores-sms-explained')) &&
    /three years of roadside inspection history|three years of inspection/.test(
      bodyOf('csa-scores-sms-explained'),
    ) &&
    /24 months/.test(bodyOf('csa-scores-sms-explained')),
);
check(
  'OOS article restates no numeric CVSA thresholds (only regulatory 392.5)',
  !/\d+\/32|20 percent|20%/.test(bodyOf('cvsa-out-of-service-criteria')) &&
    /392\.5/.test(bodyOf('cvsa-out-of-service-criteria')),
);
check(
  'testing article: 0.04 vs 0.02 lines + follow-up plan minimums',
  /0\.04/.test(bodyOf('drug-alcohol-testing-clearinghouse')) &&
    /0\.02/.test(bodyOf('drug-alcohol-testing-clearinghouse')) &&
    /6 tests in the first 12 months|6\+ tests in 12 months/.test(
      bodyOf('drug-alcohol-testing-clearinghouse'),
    ),
);
check(
  'securement article: half-weight aggregate WLL + 393.110 counts + 392.9 intervals',
  /at least 50% of the cargo weight|half the cargo weight/i.test(
    bodyOf('cargo-securement-basics'),
  ) &&
    /one tie-down for articles 5 ft/i.test(bodyOf('cargo-securement-basics')) &&
    /3 hours or 150 miles/.test(bodyOf('cargo-securement-basics')),
);
check(
  'annual article: 12 months + 14-month retention + Appendix A',
  /12 months/.test(bodyOf('annual-dot-inspection')) &&
    /14 months/.test(bodyOf('annual-dot-inspection')) &&
    /Appendix A/.test(bodyOf('annual-dot-inspection')),
);
check(
  'medical article: 24-month max + examiner determination + not-medical-advice',
  /24 months/.test(bodyOf('dot-medical-card')) &&
    /examiner/.test(bodyOf('dot-medical-card')) &&
    /not medical advice/i.test(bodyOf('dot-medical-card')),
);
check(
  'lighting article: operable-at-all-times + amber-forward/red-rear logic',
  /at all times/.test(bodyOf('truck-lighting-requirements')) &&
    /amber/i.test(bodyOf('truck-lighting-requirements')) &&
    /red/i.test(bodyOf('truck-lighting-requirements')),
);

// ── 9. Rendering stack still wired ──────────────────────────────────────────
const page = read('src/app/(marketing)/knowledge/[category]/[slug]/page.tsx');
check(
  'article page emits Article + FAQ + breadcrumb schema',
  /articleSchema/.test(page) && /faqSchema/.test(page) && /breadcrumbSchema/.test(page),
);
check('article page renders visible FAQs from schema data', /FaqBlock/.test(page));
check(
  'canonical built from category+slug',
  /\/knowledge\/\$\{params\.category\}/.test(page) ||
    /\/knowledge\/\$\{category\.slug\}\/\$\{article\.slug\}/.test(page),
);
check(
  'FAQ schema gated on visible FAQ content',
  /if \(!article\.faqs\?\.length\) return null/.test(read('src/lib/kc/schema.ts')),
);
const mdx = read('src/lib/kc/mdx.ts');
check(
  'renderer supports internal links, em, and quote escaping',
  /isInternal/.test(mdx) && /<em>/.test(mdx) && /&quot;/.test(mdx),
);
check(
  'AuthorBlock shows the last-reviewed date',
  /Last reviewed against the eCFR/.test(read('src/components/kc/AuthorBlock.tsx')),
);
check('sitemap derives KC articles from the DB', /kc_articles/.test(read('src/app/sitemap.ts')));

// ── 10. Untouched surfaces ──────────────────────────────────────────────────
for (const f of [
  'src/lib/tests/catalog.ts',
  'src/app/(learn)/practice-tests/page.tsx',
  'src/components/admin/AdminNav.tsx',
]) {
  check(`${f} has no KC coupling`, !/kc_articles|kc_categories/.test(read(f)));
}

// ── Done ────────────────────────────────────────────────────────────────────
console.log(`\nKnowledge Center tests: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
