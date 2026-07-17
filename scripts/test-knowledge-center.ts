/**
 * Knowledge Center validation suite — Batch 1 (037, HOS + inspections),
 * Batch 2 (038, DOT Compliance cluster), Batch 3 (040, Getting Your CDL
 * cluster), and Batch 4 (042, Careers & Money cluster): 40 authority pages.
 *
 * Batch 4 seeds into the pre-existing (empty) 'trucking-careers' category and
 * carries extra money discipline: no invented pay/CPM/salary/dollar figures,
 * an information-not-financial-advice disclaimer, and pay described
 * structurally with live wage data pointed to on BLS.
 *
 * Checks per batch and across all four:
 *   - exact slug sets; unique titles / SEO titles / meta descriptions
 *   - official-domain-only sources in canonical eCFR/FMCSA/CVSA/TPR formats
 *   - required structure per batch (quick answer, disclaimer + review date,
 *     definition, who, steps, labeled examples, mistakes, risks/trade-offs,
 *     checklist, keep-learning, CTAs, practice-test links)
 *   - every internal link resolves; cross-cluster bridges exist; ≤2 in-body
 *     links per target per article
 *   - FAQ uniqueness across all 40 pages; FAQ answers substantial
 *   - no duplicated substantial paragraphs anywhere
 *   - number consistency; no unsupported claim patterns; no invented money
 *     (Batch 4: no dollar/CPM/salary figures; pay described structurally)
 *   - migration mechanics: guarded inserts, guarded category creation (040
 *     only; 042 seeds into a pre-existing category and never creates one),
 *     conflict-safe kc_related, guarded replace-based cross-link UPDATEs
 *     (038: three into Batch 1; 040: four into Batches 1–2; 042: three into
 *     Batch 3), nothing destructive anywhere
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
const seed3 = read('supabase/migrations/040_seed_kc_getting_your_cdl_articles.sql');
const seed4 = read('supabase/migrations/042_seed_kc_careers_money_articles.sql');

// ── 1. Migration mechanics ──────────────────────────────────────────────────
const guardRe =
  /if not exists \(select 1 from public\.kc_articles where category_id = v_\w+ and slug = '/g;
check('037: ten guarded inserts', (seed1.match(guardRe) ?? []).length === 10);
check('038: ten guarded inserts', (seed2.match(guardRe) ?? []).length === 10);
check('040: ten guarded inserts', (seed3.match(guardRe) ?? []).length === 10);
check('042: ten guarded inserts', (seed4.match(guardRe) ?? []).length === 10);
for (const [name, s] of [
  ['037', seed1],
  ['038', seed2],
  ['040', seed3],
  ['042', seed4],
] as const) {
  check(
    `${name}: kc_related inserts are conflict-safe`,
    /on conflict \(article_id, related_id\) do nothing/.test(s),
  );
  check(
    `${name}: nothing destructive (no drop/truncate/delete)`,
    !/drop table|drop column|truncate|delete from/i.test(s),
  );
}
check('037: never creates categories', !/insert into public\.kc_categories/.test(seed1));
check('038: never creates categories', !/insert into public\.kc_categories/.test(seed2));
check(
  '040: creates exactly one category, guarded by not-exists on the slug',
  (seed3.match(/insert into public\.kc_categories/g) ?? []).length === 1 &&
    /where not exists \(select 1 from public\.kc_categories where slug = 'getting-your-cdl'\)/.test(
      seed3,
    ),
);
check(
  '040: category is additive only (no category updates)',
  !/update public\.kc_categories/.test(seed3),
);
check('037: never updates existing articles', !/update public\.kc_articles/.test(seed1));
const crossLinkUpdates2 =
  seed2.match(/update public\.kc_articles a set body_mdx = replace\(/g) ?? [];
check('038: exactly three Batch 1 UPDATEs, all replace-based', crossLinkUpdates2.length === 3);
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
const crossLinkUpdates3 =
  seed3.match(/update public\.kc_articles a set body_mdx = replace\(/g) ?? [];
check('040: exactly four inbound-link UPDATEs, all replace-based', crossLinkUpdates3.length === 4);
check(
  '040: no other UPDATE statements of any kind (038 likewise)',
  (seed3.match(/update public\./g) ?? []).length === 4 &&
    (seed2.match(/update public\./g) ?? []).length === 3,
);
check(
  '040: every UPDATE is presence-guarded AND absence-guarded (idempotent)',
  (seed3.match(/and a\.body_mdx like '%/g) ?? []).length === 4 &&
    (seed3.match(/and a\.body_mdx not like '%\/knowledge\/getting-your-cdl\//g) ?? []).length === 4,
);
check(
  '040: UPDATEs are slug-scoped to the three intended articles',
  /a\.slug = 'dot-medical-card'/.test(seed3) &&
    /a\.slug = 'drug-alcohol-testing-clearinghouse'/.test(seed3) &&
    /a\.slug = 'cdl-pre-trip-inspection-guide'/.test(seed3),
);
check(
  '040: all ten article inserts use the getting-your-cdl category variable',
  (seed3.match(/values \(\s*v_gyc,/g) ?? []).length === 10,
);
// Batch 4 (042) seeds into the PRE-EXISTING trucking-careers category and must
// never create or alter a category.
check('042: never creates categories', !/insert into public\.kc_categories/.test(seed4));
check('042: never alters categories', !/update public\.kc_categories/.test(seed4));
check(
  '042: all ten article inserts use the trucking-careers category variable',
  (seed4.match(/values \(\s*v_car,/g) ?? []).length === 10,
);
check(
  '042: looks up trucking-careers and raises if the category is missing',
  /select id into v_car from public\.kc_categories where slug = 'trucking-careers'/.test(seed4) &&
    /raise exception 'Knowledge Center categories missing/.test(seed4),
);
const crossLinkUpdates4 =
  seed4.match(/update public\.kc_articles a set body_mdx = replace\(/g) ?? [];
check('042: exactly three inbound-link UPDATEs, all replace-based', crossLinkUpdates4.length === 3);
check(
  '042: no other UPDATE statements of any kind',
  (seed4.match(/update public\./g) ?? []).length === 3,
);
check(
  '042: every UPDATE is presence-guarded AND absence-guarded (idempotent)',
  (seed4.match(/and a\.body_mdx like '%/g) ?? []).length === 3 &&
    (seed4.match(/and a\.body_mdx not like '%\/knowledge\/trucking-careers\//g) ?? []).length === 3,
);
check(
  '042: UPDATEs are slug-scoped to the three Batch 3 targets, all in getting-your-cdl',
  /a\.slug = 'how-to-get-your-cdl'/.test(seed4) &&
    /a\.slug = 'cdl-cost'/.test(seed4) &&
    /a\.slug = 'sponsored-vs-private-cdl-school'/.test(seed4) &&
    (seed4.match(/and c\.slug = 'getting-your-cdl'/g) ?? []).length === 3,
);

// ── 2. Parse all 40 article records ─────────────────────────────────────────
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
const BATCH3 = [
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
];
const BATCH4 = [
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
for (const s of BATCH3) CAT_OF[s] = 'getting-your-cdl';
for (const s of BATCH4) CAT_OF[s] = 'trucking-careers';

type Article = {
  slug: string;
  batch: 1 | 2 | 3 | 4;
  title: string;
  body: string;
  metaTitle: string;
  metaDescription: string;
  sources: { label: string; url: string }[];
  faqs: { q: string; a: string }[];
};
const blockRe =
  /values \(\s*v_(?:hos|dot|cdl|gyc|car),\s*'([^']+)',\s*'((?:[^']|'')+)',\s*'((?:[^']|'')+)',\s*\$mdx\$([\s\S]*?)\$mdx\$,\s*'((?:[^']|'')+)',\s*'((?:[^']|'')+)',\s*'Shawn Gresham', v_bio,\s*\$j\$([\s\S]*?)\$j\$::jsonb,\s*\$j\$([\s\S]*?)\$j\$::jsonb/g;
const articles: Article[] = [];
for (const [batch, s] of [
  [1, seed1],
  [2, seed2],
  [3, seed3],
  [4, seed4],
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
// Apply 038's three Batch-1 replacements and 040's three inbound-link
// replacements so every content check below evaluates the EFFECTIVE
// post-migration text (what production serves).
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
// 040's replacements are EXTRACTED from the migration itself (not hardcoded)
// so a drifted search string that would silently no-op in Postgres fails here.
const updateRe =
  /replace\(\s*a\.body_mdx,\s*'((?:[^']|'')*)',\s*'((?:[^']|'')*)'\)[\s\S]*?a\.slug = '([a-z0-9-]+)'/g;
const extracted: { search: string; replacement: string; slug: string }[] = [];
let um: RegExpExecArray | null;
updateRe.lastIndex = 0;
while ((um = updateRe.exec(seed3)) !== null) {
  extracted.push({
    search: um[1].replace(/''/g, "'"),
    replacement: um[2].replace(/''/g, "'"),
    slug: um[3],
  });
}
check('040: all four replacement pairs parse from the migration', extracted.length === 4);
for (const { search, replacement, slug } of extracted) {
  const target = articles.find((a) => a.slug === slug);
  check(
    `040 replacement target text exists exactly once in ${slug}`,
    !!target && target.body.split(search).length === 2,
  );
  if (target) target.body = target.body.replace(search, replacement);
  check(
    `040 replacement for ${slug} grows the text and adds an internal link`,
    replacement.length > search.length && /\]\(\/knowledge\//.test(replacement),
  );
}
// 042's three inbound cross-links point INTO the new trucking-careers cluster
// from three Batch 3 pages — extracted from the migration and applied to the
// already-parsed Batch 3 bodies so downstream link checks see effective text.
const extracted4: { search: string; replacement: string; slug: string }[] = [];
updateRe.lastIndex = 0;
while ((um = updateRe.exec(seed4)) !== null) {
  extracted4.push({
    search: um[1].replace(/''/g, "'"),
    replacement: um[2].replace(/''/g, "'"),
    slug: um[3],
  });
}
check('042: all three replacement pairs parse from the migration', extracted4.length === 3);
for (const { search, replacement, slug } of extracted4) {
  const target = articles.find((a) => a.slug === slug);
  check(
    `042 replacement target text exists exactly once in ${slug}`,
    !!target && target.body.split(search).length === 2,
  );
  if (target) target.body = target.body.replace(search, replacement);
  check(
    `042 replacement for ${slug} grows the text and links into trucking-careers`,
    replacement.length > search.length && /\]\(\/knowledge\/trucking-careers\//.test(replacement),
  );
}
check('all 40 articles parse (10 per batch)', articles.length === 40, articles.length);
check(
  "038's and 040's replacements all matched real seeded text (effective content differs)",
  articles
    .find((a) => a.slug === 'cdl-hours-of-service-rules')!
    .body.includes('/knowledge/dot-compliance/csa-scores-sms-explained') &&
    articles
      .find((a) => a.slug === 'level-1-dot-inspection')!
      .body.includes('/knowledge/dot-compliance/dataqs-disputes') &&
    !articles
      .find((a) => a.slug === '11-hour-driving-limit')!
      .body.includes('[60/70-hour totals](') &&
    articles
      .find((a) => a.slug === 'dot-medical-card')!
      .body.includes('/knowledge/getting-your-cdl/cdl-requirements') &&
    articles
      .find((a) => a.slug === 'drug-alcohol-testing-clearinghouse')!
      .body.includes('/knowledge/getting-your-cdl/cdl-requirements') &&
    articles
      .find((a) => a.slug === 'cdl-pre-trip-inspection-guide')!
      .body.includes('/knowledge/getting-your-cdl/cdl-skills-test'),
);
check(
  'slug sets match the plan exactly',
  BATCH1.every((s) => articles.some((a) => a.slug === s && a.batch === 1)) &&
    BATCH2.every((s) => articles.some((a) => a.slug === s && a.batch === 2)) &&
    BATCH3.every((s) => articles.some((a) => a.slug === s && a.batch === 3)) &&
    BATCH4.every((s) => articles.some((a) => a.slug === s && a.batch === 4)),
);
check('titles unique across 40', new Set(articles.map((a) => a.title)).size === 40);
check('meta titles unique across 40', new Set(articles.map((a) => a.metaTitle)).size === 40);
check(
  'meta descriptions unique across 40',
  new Set(articles.map((a) => a.metaDescription)).size === 40,
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
    (seed2.match(/'published', true, '2026-07-17', v_pub/g) ?? []).length === 10 &&
    (seed3.match(/'published', true, '2026-07-17', v_pub/g) ?? []).length === 10 &&
    (seed4.match(/'published', true, '2026-07-17', v_pub/g) ?? []).length === 10,
);

// ── 3. Official sources only, canonical formats ─────────────────────────────
const OFFICIAL = [
  'www.ecfr.gov',
  'www.fmcsa.dot.gov',
  'eld.fmcsa.dot.gov',
  'csa.fmcsa.dot.gov',
  'dataqs.fmcsa.dot.gov',
  'clearinghouse.fmcsa.dot.gov',
  'tpr.fmcsa.dot.gov',
  'www.cvsa.org',
  // Batch 4 (Careers & Money) primary sources — BLS wage data, IRS tax rules,
  // DOL wage-and-hour. Government-published, neutral, and citable.
  'www.bls.gov',
  'www.irs.gov',
  'www.dol.gov',
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

// ── 4. FAQs unique across all 40 pages ──────────────────────────────────────
check(
  'every article has 4+ FAQs',
  articles.every((a) => a.faqs.length >= 4),
);
const allFaqQs = articles.flatMap((a) => a.faqs.map((f) => f.q));
check('no FAQ question reused across the 40 pages', new Set(allFaqQs).size === allFaqQs.length);
check(
  'every FAQ answer is substantial (80+ chars)',
  articles.every((a) => a.faqs.every((f) => f.a.length >= 80)),
);

// ── 5. Required structure in every body (per batch) ─────────────────────────
const b12 = articles.filter((a) => a.batch === 1 || a.batch === 2);
const b3 = articles.filter((a) => a.batch === 3);
const b4 = articles.filter((a) => a.batch === 4);
const b123 = articles.filter((a) => a.batch !== 4);
// Universal across all 40 pages.
const shared: [string, RegExp][] = [
  ['direct answer at the top', /^\*\*Quick answer:\*\*/],
  ['common mistakes section', /## Common mistakes/],
  ['keep-learning block', /## Keep learning/],
  ['academy CTA', /\/academy\)/],
  ['email-list CTA', /\/#newsletter\)/],
];
for (const [name, re] of shared) {
  check(
    `every body has: ${name}`,
    articles.every((a) => re.test(a.body)),
    articles.filter((a) => !re.test(a.body)).map((a) => a.slug),
  );
}
// Batch 1–3 (regulatory content): the regulatory-change disclaimer, a
// definition section, and a practice-test link on every page.
const b123Shared: [string, RegExp][] = [
  [
    'regulatory-change disclaimer with review date',
    /\*\*Regulatory-change disclaimer:\*\*[\s\S]*July 17, 2026/,
  ],
  ['definition section', /## What |## The (requirements|two numbers|CDL process)/],
  ['practice-test link', /\/practice-tests/],
];
for (const [name, re] of b123Shared) {
  check(
    `every Batch 1–3 body has: ${name}`,
    b123.every((a) => re.test(a.body)),
    b123.filter((a) => !re.test(a.body)).map((a) => a.slug),
  );
}
// Batch 4 (Careers & Money): information-not-financial-advice disclaimer with
// review date, an orienting definition/why section, a labeled illustration,
// a checklist or decision-guide, and the CDL Pre-School CTA.
const b4Structure: [string, RegExp][] = [
  [
    'information disclaimer with review date',
    /\*\*Information disclaimer:\*\* Last reviewed \*\*July 17, 2026\*\*/,
  ],
  ['not financial/tax/legal advice language', /\*\*not [^*]{0,60}advice\*\*/i],
  ['orienting definition or why/what section', /## (What|Why|The|Two|A CDL|Home time|Benefits) /],
  ['labeled illustration (not a claim)', /\([Ii]llustration[^)]{0,120}not /],
  ['checklist or decision-guide section', /## [^\n]*checklist|## Which |## Who should/i],
  ['pre-school CTA', /\/cdl-pre-school\)/],
];
for (const [name, re] of b4Structure) {
  check(
    `every Batch 4 body has: ${name}`,
    b4.every((a) => re.test(a.body)),
    b4.filter((a) => !re.test(a.body)).map((a) => a.slug),
  );
}
// Money discipline: Batch 4 invents no pay figures anywhere (body or FAQs).
check(
  'Batch 4 quotes no dollar amounts (no invented pay/salary/fees)',
  b4.every((a) => !/\$\d/.test(a.body) && !/\$\d/.test(JSON.stringify(a.faqs))),
  b4.filter((a) => /\$\d/.test(a.body) || /\$\d/.test(JSON.stringify(a.faqs))).map((a) => a.slug),
);
check(
  'Batch 4 quotes no CPM rate numbers',
  b4.every(
    (a) =>
      !/\d+\s?(cpm|cents per mile|¢ per mile|¢\/mile)/i.test(a.body) &&
      !/\d+\s?(cpm|cents per mile)/i.test(JSON.stringify(a.faqs)),
  ),
  b4
    .filter((a) => /\d+\s?(cpm|cents per mile)/i.test(a.body + JSON.stringify(a.faqs)))
    .map((a) => a.slug),
);
check(
  'Batch 4 invents no salary or annual-pay figures',
  b4.every(
    (a) =>
      !/\d[\d,]*\s*(per year|a year|annually|\/yr|per week|per mile)/i.test(a.body) &&
      !/(salary|earns?|makes?|pays?)[^.]{0,20}\d[\d,]{2,}/i.test(a.body),
  ),
  b4
    .filter((a) => /\d[\d,]*\s*(per year|a year|annually|\/yr|per week|per mile)/i.test(a.body))
    .map((a) => a.slug),
);
check(
  'Batch 4 points to live BLS wage data rather than hardcoding it',
  b4
    .filter((a) => a.slug === 'cdl-truck-driver-pay' || a.slug === 'what-is-a-good-cpm-rate')
    .every((a) => /bls\.gov/.test(a.body)),
);
check(
  'Batch 4 every spoke links the cluster pillar (cdl-truck-driver-pay)',
  b4
    .filter((a) => a.slug !== 'cdl-truck-driver-pay')
    .every((a) => a.body.includes('/knowledge/trucking-careers/cdl-truck-driver-pay')),
  b4
    .filter(
      (a) =>
        a.slug !== 'cdl-truck-driver-pay' &&
        !a.body.includes('/knowledge/trucking-careers/cdl-truck-driver-pay'),
    )
    .map((a) => a.slug),
);
check(
  'Batch 4 cross-cluster bridge: career-paths links into getting-your-cdl',
  b4.find((a) => a.slug === 'trucking-career-paths')!.body.includes('/knowledge/getting-your-cdl/'),
);
check(
  'Batch 3 → Batch 4 inbound cross-links landed (pillar, cost, sponsored)',
  b3
    .find((a) => a.slug === 'how-to-get-your-cdl')!
    .body.includes('/knowledge/trucking-careers/trucking-career-paths') &&
    b3
      .find((a) => a.slug === 'cdl-cost')!
      .body.includes('/knowledge/trucking-careers/cdl-truck-driver-pay') &&
    b3
      .find((a) => a.slug === 'sponsored-vs-private-cdl-school')!
      .body.includes('/knowledge/trucking-careers/owner-operator-vs-company-driver'),
);
const b12Structure: [string, RegExp][] = [
  ['why section', /## Why /],
  ['who section', /## Who /],
  ['labeled real-world example', /\(illustration, not legal advice\)/],
  ['risks section', /## (Violations and compliance risks|Compliance risks)/],
  ['driver checklist section', /## Driver checklist/],
];
for (const [name, re] of b12Structure) {
  check(
    `every Batch 1–2 body has: ${name}`,
    b12.every((a) => re.test(a.body)),
    b12.filter((a) => !re.test(a.body)).map((a) => a.slug),
  );
}
const b3Structure: [string, RegExp][] = [
  ['who-it-applies section', /## Who /],
  ['pre-school CTA', /\/cdl-pre-school\)/],
  [
    'step-by-step or ordered walkthrough',
    /## The steps|## Week by week|## Part 1|step by step|in the order|## Gate 1|## The (six endorsements|fee categories|two models|tests that earn it|two numbers)/i,
  ],
  ['labeled real-world example', /\(illustration[^)]*\)/],
  ['costs, risks, or trade-offs treated', /cost|trade-off|risk|restrict|repayment|fee/i],
  ['checklist section', /## [^\n]*checklist/i],
];
for (const [name, re] of b3Structure) {
  check(
    `every Batch 3 body has: ${name}`,
    b3.every((a) => re.test(a.body)),
    b3.filter((a) => !re.test(a.body)).map((a) => a.slug),
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
  'authority labeling present where rules could blur (Batches 1–2)',
  b12.every(
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
);
check(
  'Batch 3 bodies distinguish federal rules from state variation',
  b3.every((a) => /[Ff]ederal/.test(a.body) && /state/i.test(a.body)),
  b3.filter((a) => !(/[Ff]ederal/.test(a.body) && /state/i.test(a.body))).map((a) => a.slug),
);
check(
  'Batch 3 recommendation labeling where prep advice is given',
  ['cdl-study-plan'].every((s) =>
    /recommendation[^.]*not a (federal )?(requirement|rule)/i.test(
      b3.find((a) => a.slug === s)!.body,
    ),
  ),
);
check(
  'no unsupported-claim patterns (invented fines/statistics)',
  articles.every(
    (a) => !/\$\d{1,3},?\d{0,3} fine|\d+% of (all )?(trucks|drivers|inspections)/i.test(a.body),
  ),
);
check(
  'Batch 3 quotes no dollar amounts anywhere (no invented tuition/fees)',
  b3.every((a) => !/\$\d/.test(a.body) && !/\$\d/.test(JSON.stringify(a.faqs))),
  b3.filter((a) => /\$\d/.test(a.body)).map((a) => a.slug),
);
check(
  'Batch 3 never invents federal minimum training hours',
  b3.every((a) => !/federal(ly)?[^.]{0,40}(minimum|required)[^.]{0,20}\d+\s*hours/i.test(a.body)),
);
check(
  'no salary or pass-rate claims in Batch 3',
  b3.every((a) => !/average (salary|pay)|\d+% pass rate|placement rate of \d+/i.test(a.body)),
);
check(
  'medical/testing articles avoid outcome-promising language',
  ['dot-medical-card', 'drug-alcohol-testing-clearinghouse'].every((s) => {
    const b = articles.find((a) => a.slug === s)!.body;
    return !/you will qualify|you are disqualified|guaranteed to pass/i.test(b);
  }),
);
check(
  'sponsored-school article avoids one-sided characterization and guarantees',
  (() => {
    const b = b3.find((a) => a.slug === 'sponsored-vs-private-cdl-school')!.body;
    return (
      /[Nn]either is "better"|fit different/.test(b) &&
      /have no standard definition|not job offers/.test(b) &&
      /Neither generalization survives/.test(b)
    );
  })(),
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
  '/practice-tests/tanker',
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
  articles
    .filter(
      (a) => new Set([...a.body.matchAll(/\]\((\/knowledge\/[^)]+)\)/g)].map((x) => x[1])).size < 3,
    )
    .map((a) => a.slug),
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
const b2body = (slug: string) => articles.find((a) => a.slug === slug && a.batch === 2)!.body;
const b3body = (slug: string) => articles.find((a) => a.slug === slug && a.batch === 3)!.body;
check(
  'every Batch 2 spoke links the cluster pillar',
  BATCH2.filter((s) => s !== 'dot-inspection-levels-compared').every((s) =>
    b2body(s).includes('/knowledge/dot-compliance/dot-inspection-levels-compared'),
  ),
);
check(
  'every Batch 3 spoke links the cluster pillar',
  BATCH3.filter((s) => s !== 'how-to-get-your-cdl').every((s) =>
    b3body(s).includes('/knowledge/getting-your-cdl/how-to-get-your-cdl'),
  ),
  BATCH3.filter(
    (s) =>
      s !== 'how-to-get-your-cdl' &&
      !b3body(s).includes('/knowledge/getting-your-cdl/how-to-get-your-cdl'),
  ),
);
check(
  'cross-cluster bridges exist (OOS↔HOS, DVIR↔pre-trip, CSA↔DataQs, annual↔pre-trip, securement↔GK test)',
  b2body('cvsa-out-of-service-criteria').includes('/knowledge/hours-of-service/') &&
    b2body('dvir-explained').includes('/knowledge/cdl-training/cdl-pre-trip-inspection-guide') &&
    b2body('csa-scores-sms-explained').includes('/knowledge/dot-compliance/dataqs-disputes') &&
    b2body('annual-dot-inspection').includes(
      '/knowledge/cdl-training/cdl-pre-trip-inspection-guide',
    ) &&
    b2body('cargo-securement-basics').includes('/practice-tests/general-knowledge'),
);
check(
  'Batch 3 bridges exist (requirements↔medical+clearinghouse, skills↔pre-trip, study-plan↔all five tests)',
  b3body('cdl-requirements').includes('/knowledge/dot-compliance/dot-medical-card') &&
    b3body('cdl-requirements').includes(
      '/knowledge/dot-compliance/drug-alcohol-testing-clearinghouse',
    ) &&
    b3body('cdl-skills-test').includes('/knowledge/cdl-training/cdl-pre-trip-inspection-guide') &&
    ['general-knowledge', 'air-brakes', 'combination-vehicles', 'hazmat', 'tanker'].every((t) =>
      b3body('cdl-study-plan').includes(`/practice-tests/${t}`),
    ),
);
check(
  'the Batch 3 pillar receives an inbound link from Batch 1 (pre-trip guide)',
  articles
    .find((a) => a.slug === 'cdl-pre-trip-inspection-guide')!
    .body.includes('/knowledge/getting-your-cdl/how-to-get-your-cdl'),
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

// ── 7. No duplicated substance across the 30 articles ───────────────────────
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
  'Batch 1 HOS spine intact after later batches (11/14/8h/7-hour split)',
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
check(
  'Batch 3 spine: 14-day CLP floor stated consistently (pillar + permit + skills)',
  /14 days/.test(bodyOf('how-to-get-your-cdl')) &&
    /14 days/.test(bodyOf('cdl-permit-explained')) &&
    /14 days|14\+ days/.test(bodyOf('cdl-skills-test')),
);
check(
  'requirements article: 21 interstate / 18–20 intrastate + one-license rule',
  /21/.test(bodyOf('cdl-requirements')) &&
    /18–20|18-20/.test(bodyOf('cdl-requirements')) &&
    /one license|one single license|one-driver\/one-license/i.test(bodyOf('cdl-requirements')),
);
check(
  'classes article: 26,001 and 10,000 thresholds + 16-occupant Class C line',
  /26,001/.test(bodyOf('cdl-classes-compared')) &&
    /10,000/.test(bodyOf('cdl-classes-compared')) &&
    /16 or more occupants|16 occupants|16\+ people/.test(bodyOf('cdl-classes-compared')),
);
check(
  'ELDT article: Feb 7 2022 date + 80% theory assessment + no-minimum-hours statement',
  /February 7, 2022/.test(bodyOf('eldt-requirements')) &&
    /80%/.test(bodyOf('eldt-requirements')) &&
    /no minimum number of training hours|no federal minimum hour count|no minimum hour count/i.test(
      bodyOf('eldt-requirements'),
    ),
);
check(
  'permit article: one-year federal cap + P/S/N-only endorsements',
  /one year/.test(bodyOf('cdl-permit-explained')) &&
    /P, S, or N|P, S, and N|only P, S, or N/.test(bodyOf('cdl-permit-explained')),
);
check(
  'endorsements article: tanker thresholds match the tanker test/catalog (119 / 1,000)',
  /119 gallons/.test(bodyOf('cdl-endorsements-restrictions')) &&
    /1,000\+? gallons|1,000 gallons/.test(bodyOf('cdl-endorsements-restrictions')),
);
check(
  'skills-test article: three parts named',
  /vehicle inspection/i.test(bodyOf('cdl-skills-test')) &&
    /basic vehicle control|basic control/i.test(bodyOf('cdl-skills-test')) &&
    /road test/i.test(bodyOf('cdl-skills-test')),
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
