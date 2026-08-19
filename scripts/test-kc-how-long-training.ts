/**
 * How Long Does CDL Training Take? — validation suite (056).
 *
 * One duration-intent Knowledge Center page in the existing cdl-training
 * category: /knowledge/cdl-training/how-long-does-cdl-training-take. This
 * harness holds the page to the same discipline the 037–055 harnesses apply,
 * plus the checks specific to this page's brief (T1–T35 below), without
 * touching those harnesses or their seed files.
 *
 * The publication gates, in the order they appear:
 *   T1  the new article parses          T2  exactly one target intent
 *   T3  indexable                       T4  self-canonical
 *   T5  title valid                     T6  meta valid
 *   T7  exactly one H1
 *   T8  ELDT duration claim source-backed (performance-based, no hour count)
 *   T9  CLP holding-period claim source-backed (14-day floor, 1-year ceiling)
 *   T10 Georgia statements source-backed (DDS)
 *   T11 no universal fake "CDL school takes X weeks" claim
 *   T12 Academy durations match the owner-approved source of truth
 *       (src/lib/academy/program.ts) — and nothing beyond it
 *   T13 no opening date                 T14 no tuition/pricing
 *   T15 no DDS/TPR school-status claim  T16 no phone/email/placeholders
 *   T17 no claude.ai links              T18 Academy CTA → canonical /academy
 *   T19–T21 Class A vs B / ELDT / pillar links resolve
 *   T22–T23 no cannibalization with the pillar or eldt-requirements
 *   T24 Article schema parses           T25 FAQ schema parses and mirrors
 *   T26 mobile-safe structure (list-built, no tables)
 *   T27 migration idempotent            T28 no destructive SQL
 *   T29 related links conflict-safe     T30 inbound links added at most once
 *   T31 corpus title/meta uniqueness    T32 touched bodies remain valid
 *   T33–T35 the migration touches only KC tables — no Scout, Navigator,
 *       or sitemap surface is referenced
 *
 * Run:
 *   npx esbuild scripts/test-kc-how-long-training.ts --bundle --platform=node \
 *     --format=cjs --jsx=automatic --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --alias:next/headers=./scripts/shims/next-headers.ts \
 *     --alias:next/cache=./scripts/shims/next-cache.ts \
 *     --loader:.css=empty \
 *     --outfile=/tmp/test-kc-hl.cjs && node /tmp/test-kc-hl.cjs
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

const seed = read('supabase/migrations/056_seed_kc_how_long_cdl_training.sql');
const priorSeeds = [
  read('supabase/migrations/037_seed_kc_authority_articles.sql'),
  read('supabase/migrations/038_seed_kc_dot_compliance_articles.sql'),
  read('supabase/migrations/040_seed_kc_getting_your_cdl_articles.sql'),
  read('supabase/migrations/042_seed_kc_careers_money_articles.sql'),
  read('supabase/migrations/045_seed_kc_dot_medical_articles.sql'),
  read('supabase/migrations/055_seed_kc_class_a_vs_class_b.sql'),
];

const SLUG = 'how-long-does-cdl-training-take';
const PATH = `/knowledge/cdl-training/${SLUG}`;

// ── T27–T30, T33–T35: migration mechanics ───────────────────────────────────
const guardRe =
  /if not exists \(select 1 from public\.kc_articles where category_id = v_\w+ and slug = '/g;
check('T27a: exactly one guarded insert', (seed.match(guardRe) ?? []).length === 1);
check('T27b: never creates categories', !/insert into public\.kc_categories/.test(seed));
check('T27c: never alters categories', !/update public\.kc_categories/.test(seed));
check(
  'T27d: looks up cdl-training AND getting-your-cdl, raising if either is missing',
  /select id into v_cdl from public\.kc_categories where slug = 'cdl-training'/.test(seed) &&
    /select id into v_gyc from public\.kc_categories where slug = 'getting-your-cdl'/.test(seed) &&
    /raise exception 'Knowledge Center categories missing/.test(seed),
);
check(
  'T29: kc_related inserts are conflict-safe',
  /on conflict \(article_id, related_id\) do nothing/.test(seed),
);
check(
  'T28: nothing destructive (no drop/truncate/delete)',
  !/drop table|drop column|truncate|delete from/i.test(seed),
);
const crossLinkUpdates = seed.match(/update public\.kc_articles a set body_mdx = replace\(/g) ?? [];
check('T30a: exactly three inbound-link UPDATEs, all replace-based', crossLinkUpdates.length === 3);
check(
  'T30b: no other UPDATE statements of any kind',
  (seed.match(/update public\./g) ?? []).length === 3,
);
check(
  'T30c: UPDATEs touch body_mdx only — titles and metadata of older pages stay theirs',
  !/set\s+(title|meta_title|meta_description|excerpt|slug|status)\s*=/i.test(seed),
);
check(
  'T30d: every UPDATE is presence-guarded AND absence-guarded (idempotent)',
  (seed.match(/and a\.body_mdx like '%/g) ?? []).length === 3 &&
    (
      seed.match(
        /and a\.body_mdx not like '%\/knowledge\/cdl-training\/how-long-does-cdl-training-take%'/g,
      ) ?? []
    ).length === 3,
);
check(
  'T30e: UPDATEs are slug-scoped to the three intended articles, all in getting-your-cdl',
  /a\.slug = 'how-to-get-your-cdl'/.test(seed) &&
    /a\.slug = 'eldt-requirements'/.test(seed) &&
    /a\.slug = 'class-a-vs-class-b-cdl'/.test(seed) &&
    (seed.match(/and c\.slug = 'getting-your-cdl'/g) ?? []).length === 3,
);
check(
  'T33–T35: the migration touches KC tables only (no Scout/Navigator/sitemap surface)',
  (() => {
    const tables = [...seed.matchAll(/public\.(\w+)/g)].map((m) => m[1]);
    const allowed = new Set(['kc_articles', 'kc_categories', 'kc_related']);
    return (
      tables.length > 0 &&
      tables.every((t) => allowed.has(t)) &&
      !/scout|navigator|trip[-_ ]planner|sitemap|robots/i.test(seed)
    );
  })(),
);

// ── T1: parse the new article + the fifty-one existing ones ────────────────
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
check('T1a: the new article parses out of the migration', mine.length === 1, mine.length);
const art = mine[0];
check('T1b: slug is the stable identifier', art.slug === SLUG, art.slug);
const corpus = priorSeeds.flatMap(parseSeed);
check('T1c: all fifty-one prior articles parse for corpus checks', corpus.length === 51);

// Effective post-migration text: apply the earlier batches' replacements in
// application order (042 → 045 → 055 → 056) so every 056 search string is
// verified against the text production actually holds.
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
for (const prior of [priorSeeds[3], priorSeeds[4], priorSeeds[5]]) {
  for (const { search, replacement, slug } of extractReplacements(prior)) {
    const target = corpus.find((a) => a.slug === slug);
    if (target && target.body.split(search).length === 2)
      target.body = target.body.replace(search, replacement);
  }
}
const extracted = extractReplacements(seed);
check('T30f: all three replacement pairs parse from the migration', extracted.length === 3);
for (const { search, replacement, slug } of extracted) {
  const target = corpus.find((a) => a.slug === slug);
  check(
    `T30g: replacement target exists exactly once in ${slug} (effective text)`,
    !!target && target.body.split(search).length === 2,
  );
  if (target) target.body = target.body.replace(search, replacement);
  check(
    `T30h: replacement for ${slug} grows the text and links the new page once`,
    replacement.length > search.length && replacement.split(PATH).length === 2,
  );
}

// ── T3–T6: metadata through the real page module ────────────────────────────
const CATEGORY: KcCategory = {
  id: 'cat-cdlt',
  slug: 'cdl-training',
  name: 'CDL Training',
  description: 'Training, the range, and the road.',
  intro_md: null,
  icon: null,
  sort_order: 4,
  meta_title: null,
  meta_description: null,
};
const ARTICLE_ROW: KcArticle = {
  id: 'art-hl',
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
  tags: ['cdl-training', 'timeline', 'how-long', 'eldt', 'clp', 'georgia'],
  reading_time_min: 8,
  featured: false,
  reg_verified: true,
  reg_verified_date: '2026-08-19',
  published_at: '2026-08-19T16:00:00Z',
  updated_at: '2026-08-19T16:00:00Z',
};

async function metadataChecks() {
  process.env.NEXT_PUBLIC_SUPABASE_URL ??= 'https://placeholder.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??= 'placeholder-anon-key';
  installPostgrestFake({
    kc_categories: [CATEGORY as unknown as Record<string, unknown>],
    kc_articles: [ARTICLE_ROW as unknown as Record<string, unknown>],
  });
  const meta: Metadata = await kcArticleMetadata({
    params: { category: 'cdl-training', slug: SLUG },
  });
  const title = typeof meta.title === 'string' ? meta.title : '';
  const canonical = typeof meta.alternates?.canonical === 'string' ? meta.alternates.canonical : '';
  const robots = meta.robots as { index?: boolean; follow?: boolean } | undefined;
  check(
    'T3: the page is indexable (index + follow)',
    robots?.index === true && robots?.follow === true,
  );
  check(
    'T4: canonical is the article URL, self-referencing',
    canonical === `${SITE.url}${PATH}`,
    canonical,
  );
  check('T4b: og:url agrees with the canonical', meta.openGraph?.url === canonical);
  check('T5b: rendered title equals the seeded meta title', title === art.metaTitle);
  check(
    'T6b: rendered description equals the seeded meta description',
    meta.description === art.metaDescription,
  );
  check(
    'T6c: openGraph type is article',
    (meta.openGraph as { type?: string })?.type === 'article',
  );
}

// ── T2, T5, T6: intent and metadata shape ───────────────────────────────────
check(
  'T2a: the H1/title targets the duration query exactly',
  art.title === 'How Long Does CDL Training Take?',
);
check(
  'T2b: the title claims no neighboring head term',
  !/how to get your cdl|step-by-step|eldt requirements|which one should you get|cdl cost|requirements:/i.test(
    art.title + ' ' + art.metaTitle,
  ),
);
check(
  'T5: meta title valid (brand suffix, ≤72 before it)',
  / \| Trucking Life with Shawn$/.test(art.metaTitle) &&
    art.metaTitle.replace(/ \| Trucking Life with Shawn$/, '').length <= 72,
);
check(
  'T6: meta description valid (70–175 chars, no duration promise)',
  art.metaDescription.length >= 70 &&
    art.metaDescription.length <= 175 &&
    !/\d+ (weeks|days|months)? ?(guaranteed|to a cdl)/i.test(art.metaDescription),
  art.metaDescription.length,
);
check(
  'excerpt substantial (80–320) with no doubled apostrophe',
  art.excerpt.length >= 80 && art.excerpt.length <= 320 && !art.excerpt.includes("''"),
  art.excerpt.length,
);

// ── T7 + T26: rendered body shape ───────────────────────────────────────────
const { html, toc } = renderMarkdown(art.body);
check('T7a: body adds no <h1> — the page template owns the single H1', !/<h1/i.test(html));
check('T7b: no level-1 markdown headings in the body', !/^# /m.test(art.body));
check('T7c: no headings deeper than h3', !/^#{4,}/m.test(art.body));
const pageSrc = read('src/app/(marketing)/knowledge/[category]/[slug]/page.tsx');
check(
  'T7d: the article template renders exactly one h1, from article.title',
  (pageSrc.match(/<h1/g) ?? []).length === 1 && /<h1[^>]*>\{article\.title\}<\/h1>/.test(pageSrc),
);
check('T26a: no markdown tables anywhere (renderer prints pipes raw)', !/^\s*\|/m.test(art.body));
check('T26b: nothing renders as a table', !/<table/i.test(html));
check('T26c: the renderer produces a TOC with the major sections', toc.length >= 10, toc.length);
const timeline =
  art.body.split('## A realistic Georgia timeline, step by step')[1]?.split(/^## /m)[0] ?? '';
const timelineRows = timeline.split('\n').filter((l) => /^- \*\*Step \d+ — /.test(l));
check(
  'T26d: the Georgia timeline is list-built with 6 labeled steps',
  timelineRows.length === 6,
  timelineRows.length,
);
const controls =
  art.body.split('## What actually controls the timeline')[1]?.split(/^## /m)[0] ?? '';
check(
  'T26e: the four timing layers are labeled list rows (federal/Georgia/school/personal)',
  /- \*\*Federal floor:\*\*/.test(controls) &&
    /- \*\*Georgia process:\*\*/.test(controls) &&
    /- \*\*School schedule:\*\*/.test(controls) &&
    /- \*\*Your calendar:\*\*/.test(controls),
);

// ── T8–T10: the load-bearing timing claims, source-backed ──────────────────
const srcUrls = art.sources.map((s) => s.url);
check(
  'T8a: ELDT stated as performance/proficiency-based with no federal hour count',
  /performance-based/.test(art.body) &&
    /no federal hour count/i.test(art.body) &&
    !/federal(ly)?[^.]{0,40}(minimum|required)[^.]{0,20}\d+\s*hours/i.test(art.body),
);
check(
  'T8b: the ELDT claim cites Part 380 inline and in sources, with the TPR',
  art.body.includes('https://www.ecfr.gov/current/title-49/part-380') &&
    art.body.includes('https://tpr.fmcsa.dot.gov/') &&
    srcUrls.includes('https://www.ecfr.gov/current/title-49/part-380') &&
    srcUrls.includes('https://tpr.fmcsa.dot.gov/'),
);
check(
  'T9a: the CLP floor and ceiling are both stated precisely',
  /first 14 days after/.test(art.body) &&
    /no more than one year from initial issuance/.test(art.body),
);
check(
  'T9b: the CLP claims cite 383.25 inline and in sources',
  art.body.includes('https://www.ecfr.gov/current/title-49/part-383/section-383.25') &&
    srcUrls.includes('https://www.ecfr.gov/current/title-49/part-383/section-383.25'),
);
check(
  'T10a: Georgia statements are DDS-backed inline and in sources',
  art.body.includes(
    'https://dds.georgia.gov/georgia-licenses-ids-and-permits/new-license-id-or-permit/how-do-i-cdl-license',
  ) &&
    art.body.includes(
      'https://dds.georgia.gov/georgia-licenses-ids-and-permits/new-license-id-or-permit/how-do-i-cdl-permit',
    ) &&
    srcUrls.some((u) => u.startsWith('https://dds.georgia.gov/')),
);
check(
  'T10b: Georgia applies the 14-day hold, and 14 days is never sold as the whole process',
  /Georgia applies the same 14-day hold/.test(art.body) &&
    !/whole process takes 14 days|cdl in 14 days|licensed in 14 days/i.test(art.body),
);
check(
  'T10c: medical language stays conditional',
  /if your operating category requires it|where your operating category requires it/.test(
    art.body,
  ) && !/every (driver|applicant) (must|needs)[^.\n]{0,30}medical/i.test(art.body),
);
check(
  'sources: 3+ entries, labels substantial, official domains, canonical eCFR format',
  art.sources.length >= 3 &&
    art.sources.every((s) => s.label.length >= 10) &&
    art.sources.every((s) =>
      ['www.ecfr.gov', 'www.fmcsa.dot.gov', 'tpr.fmcsa.dot.gov', 'dds.georgia.gov'].includes(
        new URL(s.url).host,
      ),
    ) &&
    art.sources
      .filter((s) => s.url.includes('ecfr.gov'))
      .every((s) =>
        /^https:\/\/www\.ecfr\.gov\/current\/title-49\/(part-\d+)(\/section-\d+\.\d+)?$/.test(
          s.url,
        ),
      ),
);

// ── T11: no fake universal timeline ─────────────────────────────────────────
const claimText =
  art.body + ' ' + JSON.stringify(art.faqs) + ' ' + art.excerpt + ' ' + art.metaDescription;
check(
  'T11a: the no-single-number framing is explicit',
  /no single honest number/i.test(art.body) && /no universal/i.test(claimText),
);
check(
  'T11b: no universal "takes X weeks/days/months" claim anywhere',
  !/(cdl (school|training)|training|program) (takes|lasts|is|requires) (about |around |only )?\d+\s*(week|day|month)/i.test(
    claimText,
  ) && !/all (schools|programs) (take|run|last)/i.test(claimText),
);
check(
  'T11c: the two-weeks question is answered as a floor, not a plan',
  art.faqs.some((f) => /two weeks/i.test(f.q) && /legal floor, not a plan/i.test(f.a)),
);

// ── T12: Academy durations match the owner-approved source of truth ────────
const program = read('src/lib/academy/program.ts');
const weekendLen = program.match(/length: '([^']+)'/g)?.[0]?.match(/'([^']+)'/)?.[1] ?? '';
const weekdayLen = program.match(/length: '([^']+)'/g)?.[1]?.match(/'([^']+)'/)?.[1] ?? '';
const academySection =
  art.body.split("## The Academy's published program lengths")[1]?.split(/^## /m)[0] ?? '';
check(
  'T12a: the Academy section exists, labeled as school-specific fact',
  academySection.length > 0 &&
    /\*\*School-specific facts?, not federal rules?\.\*\*/.test(academySection),
);
check(
  'T12b: the weekend duration quotes program.ts exactly (case-insensitive)',
  weekendLen.length > 0 && academySection.toLowerCase().includes(weekendLen.toLowerCase()),
  { weekendLen },
);
check(
  'T12c: the weekday duration quotes program.ts exactly (case-insensitive)',
  weekdayLen.length > 0 && academySection.toLowerCase().includes(weekdayLen.toLowerCase()),
  { weekdayLen },
);
check(
  'T12d: the not-open weekday program is not sold as enrollable',
  /not open for enrollment yet/.test(academySection),
);
check(
  'T12e: no Academy hour counts or curriculum-topic counts are invented',
  !/\d+\s*hour/i.test(academySection) && !/\d+\s*(topics|lessons|modules)/i.test(academySection),
);

// ── T13–T17: hard-stop business and hygiene gates ───────────────────────────
check(
  'T13a: no enrollment/opening date attached to any month or year',
  !/(opens?|opening|starts?|starting|begins?|beginning|enroll\w*)[^.\n]{0,40}(January|February|March|April|May|June|July|August|September|October|November|December|20\d\d)/i.test(
    claimText,
  ),
);
check(
  'T13b: the only day-precision dates are the ELDT effective date and the review stamp',
  (
    seed.match(
      /(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}/g,
    ) ?? []
  ).every((d) => ['February 7, 2022', 'August 19, 2026'].includes(d)),
  seed.match(
    /(January|February|March|April|May|June|July|August|September|October|November|December) \d{1,2}, \d{4}/g,
  ),
);
check('T14: no dollar amounts anywhere', !/\$\s?\.?\d/.test(seed));
check(
  'T14b: no pay/salary/placement claims (this page is about time)',
  !/average (salary|pay)|\d+ ?(cpm|cents per mile)|(salary|earn\w*)[^.\n]{0,15}\d|guarantee[sd]? (a )?(job|placement|employment)/i.test(
    claimText,
  ),
);
check(
  'T15: no licensed/certified/approved/registered school-status or TPR-listing claim',
  !/(licensed|certified|approved|registered)[^.\n]{0,60}(CDL school|academy|training school)/i.test(
    claimText,
  ) &&
    !/(DDS|state)[- ](licensed|certified|approved)/i.test(claimText) &&
    !/Trucking Life Academy[^.\n]{0,80}(licensed|certified|approved|registered|listed|enroll)/i.test(
      claimText,
    ) &&
    !/(Academy|our school|the school)[^.\n]{0,60}(Training Provider Registry|TPR)/i.test(claimText),
);
check(
  'T16a: no ENROLL-LINK / ACADEMY-PHONE / ACADEMY-EMAIL / editorial placeholders',
  !/ENROLL-LINK|ACADEMY-PHONE|ACADEMY-EMAIL/i.test(seed) &&
    !/\bTODO\b|\bTBD\b|\bFIXME\b|\bXXX\b|PLACEHOLDER/i.test(seed),
);
check(
  'T16b: no phone number or email address',
  !/\(\d{3}\) ?\d{3}[- ]\d{4}|\b\d{3}-\d{3}-\d{4}\b/.test(seed) &&
    !/[\w.+-]+@[\w-]+\.[\w.]+/.test(art.body + JSON.stringify(art.faqs)),
);
check('T17: no claude.ai URL anywhere in the migration', !/claude\.ai/i.test(seed));
check(
  'no first-person experience claims',
  !/\bEvery year I\b|\bI meet\b|\bmy students\b|\bI've\b|\bI'm\b|\bI have seen\b/i.test(
    claimText,
  ) && !/(^|[.!?]\s+)I\s/m.test(art.body),
);

// ── T18–T21: links ──────────────────────────────────────────────────────────
check(
  'T18a: the Academy CTA links the canonical hub exactly once, in canonical form',
  (art.body.match(/\]\(\/academy\)/g) ?? []).length === 1 &&
    art.body.includes('[Trucking Life Academy](/academy)') &&
    !art.body.includes('/academy/cdl-school-dalton-ga'),
);
check(
  'T18b: the CTA line carries no urgency, dates, or prices',
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
const KNOWN_ROUTES = new Set([
  '/academy',
  '/academy/curriculum',
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
  ...corpus.map((a) =>
    [
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
    ].includes(a.slug)
      ? `/knowledge/trucking-careers/${a.slug}`
      : [
            'cdl-hours-of-service-rules',
            '11-hour-driving-limit',
            '14-hour-driving-window',
            '30-minute-break-rule',
            'split-sleeper-berth-rules',
            'personal-conveyance',
            'yard-move',
            'eld-malfunctions',
          ].includes(a.slug)
        ? `/knowledge/hours-of-service/${a.slug}`
        : [
              'dot-physical-exam-what-to-expect',
              'dot-physical-requirements',
              'dot-physical-blood-pressure',
              'diabetes-and-the-dot-physical',
              'sleep-apnea-and-the-dot-physical',
              'vision-and-hearing-dot-standards',
              'dot-medical-exemptions-and-variances',
              'medications-and-the-dot-physical',
              'medical-card-renewal-and-self-certification',
              'finding-a-dot-medical-examiner',
            ].includes(a.slug)
          ? `/knowledge/health-on-the-road/${a.slug}`
          : a.slug === 'cdl-pre-trip-inspection-guide'
            ? `/knowledge/cdl-training/${a.slug}`
            : [
                  'level-1-dot-inspection',
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
                ].includes(a.slug)
              ? `/knowledge/dot-compliance/${a.slug}`
              : `/knowledge/getting-your-cdl/${a.slug}`,
  ),
  PATH,
]);
const internalLinks = [...art.body.matchAll(/\]\((\/[^)]+)\)/g)].map((x) => x[1]);
check(
  'every internal link resolves to a known route or seeded article',
  internalLinks.every((href) => KNOWN_ROUTES.has(href) || KNOWN_KC.has(href)),
  internalLinks.filter((href) => !KNOWN_ROUTES.has(href) && !KNOWN_KC.has(href)),
);
check(
  'T19: the Class A vs B link resolves and is present',
  internalLinks.includes('/knowledge/getting-your-cdl/class-a-vs-class-b-cdl'),
);
check(
  'T20: the ELDT link resolves and is present',
  internalLinks.includes('/knowledge/getting-your-cdl/eldt-requirements'),
);
check(
  'T21: the pillar link resolves and is present',
  internalLinks.includes('/knowledge/getting-your-cdl/how-to-get-your-cdl'),
);
check(
  'external body links are official domains only',
  [...art.body.matchAll(/\]\((https?:\/\/[^)]+)\)/g)].every((x) =>
    ['www.ecfr.gov', 'www.fmcsa.dot.gov', 'tpr.fmcsa.dot.gov', 'dds.georgia.gov'].includes(
      new URL(x[1]).host,
    ),
  ),
);
const kcLinkCounts = new Map<string, number>();
for (const x of art.body.matchAll(/\]\((\/knowledge\/[^)#]+)\)/g))
  kcLinkCounts.set(x[1], (kcLinkCounts.get(x[1]) ?? 0) + 1);
check(
  'link density: 3+ distinct sibling KC links, none more than twice, never self',
  kcLinkCounts.size >= 3 &&
    [...kcLinkCounts.values()].every((n) => n <= 2) &&
    !art.body.includes(`](${PATH})`),
  Object.fromEntries(kcLinkCounts),
);

// ── T22–T23: cannibalization pins ───────────────────────────────────────────
const pillar = corpus.find((a) => a.slug === 'how-to-get-your-cdl')!;
const eldt = corpus.find((a) => a.slug === 'eldt-requirements')!;
check(
  'T22a: the pillar keeps the full-process head term; this page never claims it',
  pillar.title === 'How to Get Your CDL: Complete Step-by-Step Guide' &&
    !/how to get your cdl/i.test(art.title + art.metaTitle),
);
check(
  'T22b: no FAQ reuses the pillar duration question verbatim',
  art.faqs.every((f) => f.q !== 'How long does it take to get a CDL?'),
);
check(
  'T23a: eldt-requirements keeps the ELDT head term; this page defers with a link',
  eldt.title === 'Entry-Level Driver Training (ELDT) Requirements Explained' &&
    !/eldt requirements/i.test(art.title + art.metaTitle) &&
    art.body.includes('/knowledge/getting-your-cdl/eldt-requirements'),
);
check(
  'T23b: no FAQ reuses the eldt hours question verbatim',
  art.faqs.every((f) => f.q !== 'How many hours of training does ELDT require?'),
);
check(
  'FAQ questions unique against all fifty-one existing pages',
  art.faqs.every((f) => corpus.every((a) => a.faqs.every((g) => g.q !== f.q))),
);
check(
  'T31: title / meta title / excerpt / meta description unique against the corpus',
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

// ── T32: the three touched bodies remain valid after 056 ───────────────────
for (const slug of ['how-to-get-your-cdl', 'eldt-requirements', 'class-a-vs-class-b-cdl']) {
  const body = corpus.find((a) => a.slug === slug)!.body;
  const counts = new Map<string, number>();
  for (const x of body.matchAll(/\]\((\/knowledge\/[^)#]+)\)/g))
    counts.set(x[1], (counts.get(x[1]) ?? 0) + 1);
  check(
    `T32: ${slug} still respects the 2-per-target rule and links the new page once`,
    [...counts.values()].every((n) => n <= 2) && counts.get(PATH) === 1,
    [...counts.entries()].filter(([, n]) => n > 2),
  );
}

// ── T24–T25: structured data ────────────────────────────────────────────────
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
check('T24a: Article + FAQPage + BreadcrumbList all build', schemas.length === 3);
let parsedPayload: unknown[] = [];
try {
  parsedPayload = JSON.parse(jsonLdPayload(schemas as object[]));
} catch {
  parsedPayload = [];
}
check('T24b: the JSON-LD payload round-trips through JSON.parse', parsedPayload.length === 3);
const faqNode = parsedPayload.find((n) => (n as { '@type'?: string })['@type'] === 'FAQPage') as
  | { mainEntity?: unknown[] }
  | undefined;
check(
  'T25: FAQPage mirrors the visible FAQ block one-to-one',
  faqNode?.mainEntity?.length === art.faqs.length,
);
check(
  'the article page still wires schema + visible FAQs (FaqBlock)',
  /articleSchema/.test(pageSrc) && /faqSchema/.test(pageSrc) && /FaqBlock/.test(pageSrc),
);

// ── House structure parity ──────────────────────────────────────────────────
const structure: [string, RegExp][] = [
  ['quick answer at the top', /^\*\*Quick answer:\*\*/],
  [
    'regulatory-change disclaimer with the review date',
    /\*\*Regulatory-change disclaimer:\*\*[\s\S]*August 19, 2026/,
  ],
  ['who-this-faces section', /## Who this question faces/],
  ['labeled illustration', /\(illustration, not a promise\)/],
  ['common mistakes section', /## Common mistakes/],
  ['checklist section', /## Your timeline checklist/],
  ['keep-learning block', /## Keep learning/],
  ['pre-school CTA', /\/cdl-pre-school\)/],
  ['email-list CTA', /\/#newsletter\)/],
  ['practice-test link', /\/practice-tests/],
  ['federal vs state distinction', /[Ff]ederal[\s\S]*Georgia/],
  ['no doubled apostrophes in the dollar-quoted body', /^(?![\s\S]*'')/],
];
for (const [name, re] of structure) check(`body has: ${name}`, re.test(art.body));
check(
  'published + reg-verified with the review date',
  /'published', true, '2026-08-19', v_pub/.test(seed),
);
check(
  '4+ FAQs, every answer substantial',
  art.faqs.length >= 4 && art.faqs.every((f) => f.a.length >= 80),
);

// ── T3–T6 async, then summary ───────────────────────────────────────────────
metadataChecks()
  .catch((e) => {
    check('metadata checks completed without throwing', false, String(e));
  })
  .finally(() => {
    console.log(`\nHow-long training page tests: ${passed} passed, ${failed} failed`);
    if (failed > 0) process.exit(1);
  });
