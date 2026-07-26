/**
 * FOUNDERS WALL — end-to-end verification against a real local production
 * server. Boots `next start`, drives headless Chromium, and asserts what the
 * offline harnesses cannot: that the approved tier amounts actually render,
 * that the retired "amounts are being finalized" placeholder is gone from the
 * DOM, that the FAQ structured data agrees with the visible copy, that no
 * individual founder's contribution is printed next to their name, and that
 * the page stays accessible and free of horizontal overflow on a phone.
 *
 * DATABASE CAVEAT, stated rather than hidden: the wall and the thermometer are
 * database-backed, and this environment has no network route to Supabase (the
 * egress policy blocks it). Both fail soft by design, so here the wall renders
 * empty and the thermometer shows the zeroed fallback. Everything this harness
 * checks is therefore the DB-independent part of the page: the tier cards, the
 * copy, the FAQ, the form, accessibility and layout. The database side is
 * verified separately, against production, in
 * data/founders/privacy-hardening-2026-07-26/README.md.
 *
 * Prereq: `npm run build`, and Playwright available. Then:
 *   node scripts/e2e-founders-wall.mjs
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PORT = 3127;
const BASE = `http://127.0.0.1:${PORT}`;

/**
 * Every dollar figure allowed to appear on /founders.
 *   $1,000 / $500 / $100  — the approved tier contributions
 *   $0 / $12,000          — the zeroed thermometer fallback this environment
 *                           renders with no database (raised $0 of the
 *                           $12,000 default goal, $12,000 remaining)
 * Anything else is either an invented price or a leaked per-founder amount.
 */
const APPROVED_TIER_AMOUNTS = ['$1,000', '$500', '$100'];

// Comma is a thousands separator, not part of the next match — a naive
// /\$[\d,]+/ swallows the comma that ends "$1,000," in a sentence.
// Two objects on purpose: a /g/ regex is stateful under .test(), so the
// scanning form and the predicate form must not be the same object.
const MONEY_SRC = String.raw`\$\d{1,3}(?:,\d{3})*(?:\.\d{2})?`;
const MONEY = new RegExp(MONEY_SRC, 'g');
const HAS_MONEY = new RegExp(MONEY_SRC);
const DB_FALLBACK_FIGURES = ['$0', '$12,000'];

let passed = 0;
let failed = 0;
function check(name, cond, detail) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

async function loadChromium() {
  try {
    return (await import('playwright')).chromium;
  } catch {
    const mod = await import('/opt/node22/lib/node_modules/playwright/index.js');
    return (mod.default ?? mod).chromium;
  }
}

async function waitForServer(url, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 404) return true;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`server did not start within ${timeoutMs}ms`);
}

const axeSource = readFileSync('node_modules/axe-core/axe.min.js', 'utf8');

async function axeViolations(page) {
  await page.addScriptTag({ content: axeSource });
  const r = await page.evaluate(async () =>
    window.axe.run(document, { resultTypes: ['violations'] }),
  );
  return r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
}

const overflows = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);

try {
  await fetch(`${BASE}/founders`, { signal: AbortSignal.timeout(1500) });
  console.error(`Port ${PORT} is already serving. Stop the stale server first.`);
  process.exit(2);
} catch {
  /* nothing listening, which is what we want */
}

const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
});
server.stdout.on('data', () => {});
server.stderr.on('data', () => {});

let browser;
try {
  await waitForServer(`${BASE}/founders`);
  const chromium = await loadChromium();
  browser = await chromium.launch();

  /* ------------------------------------------------- tier amounts render */
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await ctx.newPage();
    const res = await page.goto(`${BASE}/founders`, { waitUntil: 'networkidle' });
    check('/founders responds 200', res.status() === 200, res.status());

    const text = await page.evaluate(() => document.body.innerText);

    for (const [tier, amount] of [
      ['Iron Founder', '$1,000'],
      ['Steel Founder', '$500'],
      ['Brick Founder', '$100'],
    ]) {
      check(`${tier} is on the page`, text.includes(tier));
      check(`${tier} shows ${amount}`, text.includes(amount));
    }

    // The two sponsor tiers stay contact-based — named, but with no figure.
    check('Equipment Sponsor is on the page', text.includes('Equipment Sponsor'));
    check('Student Sponsor is on the page', text.includes('Student Sponsor'));
    check(
      'sponsor tiers read as arranged directly',
      /Amount arranged directly/.test(text),
      text.slice(0, 200),
    );

    // The retired placeholder must be gone from the rendered DOM, not just the source.
    check('no "amounts TBD" in the DOM', !/amounts TBD/i.test(text));
    check('no "being finalized" in the DOM', !/being finalized/i.test(text));
    check(
      'no Placeholder marker rendered',
      !(await page.evaluate(() => document.body.innerText.includes('Placeholder:'))),
    );

    // The contribution flow is unchanged: no payment, personal follow-up.
    check('page still says no payment is collected', /No payment is collected here/.test(text));
    check('page still promises personal follow-up', /Shawn will reach out personally/.test(text));
    check('page offers no checkout', !/checkout|add to cart|card number/i.test(text));
    check('page makes no guarantee', !/guarantee/i.test(text));

    /* --------------------------------------- every dollar figure is approved */
    const figures = [...text.matchAll(MONEY)].map((m) => m[0]);
    const allowed = new Set([...APPROVED_TIER_AMOUNTS, ...DB_FALLBACK_FIGURES]);
    const unexpected = [...new Set(figures)].filter((f) => !allowed.has(f));
    check(
      `every dollar figure on /founders is approved (${[...new Set(figures)].join(', ')})`,
      unexpected.length === 0,
      unexpected.join(', '),
    );

    /* ------------------------------------- FAQ structured data agrees with copy */
    const jsonLd = await page.evaluate(() =>
      [...document.querySelectorAll('script[type="application/ld+json"]')].map(
        (s) => s.textContent,
      ),
    );
    // JsonLd always emits an ARRAY payload, so flatten before looking for the
    // FAQPage node.
    const faq = jsonLd
      .flatMap((s) => {
        try {
          const parsed = JSON.parse(s);
          return Array.isArray(parsed) ? parsed : [parsed];
        } catch {
          return [];
        }
      })
      .find((o) => o && o['@type'] === 'FAQPage');
    check('an FAQPage schema is emitted', !!faq);
    const answers = (faq?.mainEntity ?? []).map((q) => q.acceptedAnswer?.text ?? '').join(' ');
    check('FAQ schema states Iron $1,000', /Iron Founder is \$1,000/.test(answers), answers);
    check('FAQ schema states Steel $500', /Steel Founder is \$500/.test(answers));
    check('FAQ schema states Brick $100', /Brick Founder is \$100/.test(answers));
    check('FAQ schema keeps sponsor tiers contact-based', /don’t have a set figure/.test(answers));
    check(
      'FAQ schema says individual amounts are not shown',
      /never displayed next to their name/.test(answers),
    );
    check(
      'FAQ schema carries no figure the page does not show',
      [...new Set([...answers.matchAll(MONEY)].map((m) => m[0]))].every((f) => allowed.has(f)),
    );

    /* ------------------------------- the tier amount is announced accessibly */
    const labels = await page.evaluate(() =>
      [...document.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label')),
    );
    check(
      'Iron amount has an accessible label',
      labels.some((l) => /Iron Founder: \$1,000 contribution/.test(l)),
      labels.filter((l) => /Founder/.test(l)).join(' | '),
    );
    check(
      'Steel amount has an accessible label',
      labels.some((l) => /Steel Founder: \$500 contribution/.test(l)),
    );
    check(
      'Brick amount has an accessible label',
      labels.some((l) => /Brick Founder: \$100 contribution/.test(l)),
    );
    check(
      'sponsor tiers say the amount is arranged directly',
      labels.some((l) => /Equipment Sponsor: contribution amount arranged directly/.test(l)),
    );

    /* ------------------------------ the interest form agrees with the cards */
    const options = await page.evaluate(() =>
      [...document.querySelectorAll('#founder_tier option')].map((o) => o.textContent.trim()),
    );
    check('the tier select exists', options.length > 0, options.join(' | '));
    check('select offers Iron — $1,000', options.includes('Iron Founder — $1,000'), options);
    check('select offers Steel — $500', options.includes('Steel Founder — $500'));
    check('select offers Brick — $100', options.includes('Brick Founder — $100'));
    check(
      'select keeps sponsor tiers contact-based',
      options.includes('Equipment Sponsor — Amount arranged directly'),
    );

    await ctx.close();
  }

  /* ---------------------------------------- a11y + mobile overflow + console */
  for (const [w, h] of [
    [360, 780],
    [390, 844],
    [1280, 900],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('console', (m) => {
      // NEXT_PUBLIC_TURNSTILE_SITE_KEY is deliberately unset in this build, and
      // the widget logs a loud, correct diagnostic saying so. That is the
      // component doing its job, not a regression — everything else is a fail.
      if (m.type() === 'error' && !m.text().includes('NEXT_PUBLIC_TURNSTILE_SITE_KEY'))
        errors.push(m.text());
    });
    await page.goto(`${BASE}/founders`, { waitUntil: 'networkidle' });

    const v = await axeViolations(page);
    check(
      `founders @${w}: no serious/critical a11y violations`,
      v.length === 0,
      v.map((x) => `${x.id}(${x.nodes.length})`).join(', '),
    );
    check(`founders @${w}: no horizontal overflow`, !(await overflows(page)));
    check(`founders @${w}: no console errors`, errors.length === 0, errors.slice(0, 3).join(' | '));

    // The tier cards must not be the thing that overflows: check each one.
    const cardOverflow = await page.evaluate(() => {
      const bad = [];
      for (const h3 of document.querySelectorAll('#tiers h3')) {
        const card = h3.closest('div.rounded-card');
        if (card && card.scrollWidth > card.clientWidth + 1) bad.push(h3.textContent);
      }
      return bad;
    });
    check(`founders @${w}: no tier card overflows`, cardOverflow.length === 0, cardOverflow);

    await ctx.close();
  }

  /* ------------------------------------- keyboard reachability of the tiers */
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/founders`, { waitUntil: 'networkidle' });
    await page.keyboard.press('Tab');
    const firstFocus = await page.evaluate(() => document.activeElement?.textContent?.trim() ?? '');
    check('tabbing reaches an interactive element', firstFocus.length > 0, firstFocus);

    // The tier select must be reachable and operable by keyboard.
    await page.focus('#founder_tier');
    await page.selectOption('#founder_tier', 'steel');
    const selected = await page.evaluate(() =>
      document.querySelector('#founder_tier')?.selectedOptions[0]?.textContent?.trim(),
    );
    check('tier select is keyboard-operable', selected === 'Steel Founder — $500', selected);
    await ctx.close();
  }

  /* --------------------- no per-founder amount is printed anywhere on the page */
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/founders`, { waitUntil: 'networkidle' });
    const html = await page.content();
    check('page HTML never mentions amount_cents', !/amount_cents/i.test(html));
    check('page HTML never mentions payment_ref', !/payment_ref/i.test(html));
    // Founder names and tier amounts must not be adjacent in the wall section.
    const wallText = await page.evaluate(() => document.querySelector('#wall')?.innerText ?? '');
    check(
      'the wall section prints no dollar figure',
      !HAS_MONEY.test(wallText),
      wallText.slice(0, 200),
    );
    await ctx.close();
  }
} finally {
  if (browser) await browser.close();
  try {
    process.kill(-server.pid, 'SIGTERM');
  } catch {
    server.kill('SIGTERM');
  }
}

console.log(`\nfounders-wall e2e: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
