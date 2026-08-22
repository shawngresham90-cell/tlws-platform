/**
 * REVENUE-3 — the first featured sale, performed in a real browser against a
 * real production server.
 *
 * WHAT ONLY THIS CAN PROVE
 *
 * The deterministic harness (scripts/test-revenue-first-sale.ts) pins the
 * RULES: given a listing, an opportunity and an instant, may this sale be
 * activated and what term would it get. It cannot show that the console the
 * owner actually touches renders those rules — that the ACTIVATE control is
 * genuinely absent when a line fails, that the expiry date is on screen at 360
 * CSS pixels rather than clipped off the right edge, or that the opportunity
 * picker replaced the free-text UUID box on every width. Those are facts about
 * a rendered page, and a rule test would pass throughout a page that showed
 * none of them.
 *
 * THE CLOCK
 *
 * Same mechanism REVENUE-2's bench uses and for the same reason: expiry is
 * decided on the server against the server's own `now`, which a browser cannot
 * move, so the mock moves the TERM instead. `POST /__mock/clock?offsetMs=n`
 * puts every fixture placement's expiry at `Date.now() + n`. That makes the
 * CAPACITY state controllable, which is what this bench needs — with the three
 * fixture placements in term the truck-washes page is full and the fourth sale
 * must be refused; with them lapsed the slot is free and the same sale must be
 * offered. Both are driven here against the shipping code, with no test hook
 * compiled into the application.
 *
 * Usage:
 *   node scripts/bench/first-sale.mjs --tree .
 *
 * The tree must hold a production `.next` built against mock-postgrest, with
 * the mock's clock set forward so the fixture placements prerender in term:
 *
 *   MOCK_PORT=54994 MOCK_REVENUE=1 MOCK_FIRST_SALE=1 MOCK_FEATURED_FIXTURES=1 \
 *   MOCK_FEATURED_SCHEMA=ready MOCK_TEXT_PROFILE=production \
 *   MOCK_FIELD_PROFILE=production node scripts/bench/mock-postgrest.mjs &
 *   curl -X POST 'http://127.0.0.1:54994/__mock/clock?offsetMs=3600000'
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54994 … npx next build
 *
 * BUILD FRESH FOR EACH RUN, and never hand-delete `.next/cache`.
 *
 * Both requirements are the same fact about ISR. Section H deliberately ends
 * with the category page regenerated against an EXPIRED term, so a second run
 * over the same tree starts from a cache that disagrees with its own first
 * assertion. And deleting `.next/cache` to "reset" it is worse than leaving it:
 * the prerender in `.next/server` survives, the revalidation bookkeeping does
 * not, and the page then serves that prerender forever while every
 * regeneration attempt aborts on the schema probe's no-store fetch. Both
 * failure modes cost a debugging cycle here and look exactly like a product
 * defect — the badge missing from a live placement — which is why they are
 * written down rather than left to be rediscovered.
 */
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import * as fs from 'node:fs';
import * as net from 'node:net';
import * as path from 'node:path';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const TREE = arg('tree', '.');
const PORT = Number(arg('port', '3181'));

/**
 * `NEXT_PUBLIC_SUPABASE_URL` is INLINED AT BUILD TIME, so a production server
 * talks to whatever URL the build baked in regardless of the environment it is
 * started with. Read that port out of the build and listen there rather than
 * serving a mock nobody calls.
 */
function bakedMockPort(tree) {
  const candidates = [
    '.next/server/app/admin/(dashboard)/directory/placements/page.js',
    '.next/server/app/(directory)/directory/[category]/page.js',
    '.next/server/src/middleware.js',
    '.next/server/middleware.js',
  ];
  for (const rel of candidates) {
    const p = path.join(tree, rel);
    if (!fs.existsSync(p)) continue;
    const m = fs.readFileSync(p, 'utf8').match(/http:\/\/127\.0\.0\.1:(\d+)/);
    if (m) return Number(m[1]);
  }
  return null;
}

const REQUESTED_MOCK_PORT = arg('mock-port', null);
const BAKED = bakedMockPort(TREE);
const MOCK_PORT = Number(REQUESTED_MOCK_PORT ?? BAKED ?? 54994);
if (BAKED && REQUESTED_MOCK_PORT && Number(REQUESTED_MOCK_PORT) !== BAKED) {
  console.error(
    `refusing to run: the build talks to 127.0.0.1:${BAKED} (baked in at build time), ` +
      `but --mock-port ${REQUESTED_MOCK_PORT} was given. Rebuild against that port, or omit it.`,
  );
  process.exit(2);
}

/** The unfeatured fixture — the listing the first sale is made against. */
const CANDIDATE = 'Bench Featured Placement 4';
const CANDIDATE_ID = '0f000000-0000-4000-8000-000000000004';
/** One of the three already-featured fixtures, for renewal and stop. */
const LIVE_ID = '0f000000-0000-4000-8000-000000000001';
/** closed_won · featured-listing · $99 paid and confirmed. */
const PAID_OPPORTUNITY = '44444444-4444-4444-8444-444444444444';
/** contacted · featured-listing · nothing paid. */
const UNPAID_OPPORTUNITY = '22222222-2222-4222-8222-222222222222';

/** The placements panel itself, not the admin shell around it. */
const PANEL = 'div.max-w-4xl';

const WIDTHS = [
  { w: 360, h: 740 },
  { w: 390, h: 844 },
  { w: 430, h: 932 },
  { w: 1280, h: 800 },
];

/** Throwaway credentials for the local server this bench starts. Not real. */
const BENCH_ADMIN_PW = 'not-a-real-password-local-bench-only';
const BENCH_SESSION_SEED = 'not-a-real-secret-local-bench-only';
/** Same derivation as src/lib/admin/auth.ts issuedSessionToken(). */
const SESSION_TOKEN = createHmac('sha256', BENCH_SESSION_SEED)
  .update('tlws-admin-session-v1')
  .digest('hex');

const KNOWN_BUILD_ENV_WARNINGS = [/NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set in this build/];
const isPageError = (text) => !KNOWN_BUILD_ENV_WARNINGS.some((re) => re.test(text));

let passed = 0;
let failed = 0;
const check = (name, cond, detail) => {
  if (cond) passed++;
  else {
    failed++;
    console.log(`  FAIL: ${name}`, detail === undefined ? '' : JSON.stringify(detail));
  }
};

/** Section marker. Reports how many checks the previous section contributed. */
let sectionMark = 0;
function section(title) {
  if (passed + failed > sectionMark) console.log(`    (${passed + failed - sectionMark} checks)`);
  sectionMark = passed + failed;
  if (title) console.log(`\n\u2014 ${title} \u2014`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(url, tries = 90) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status === 307 || res.status === 302) return true;
    } catch {
      /* not up */
    }
    await sleep(500);
  }
  return false;
}

/** Move every fixture placement's term to `Date.now() + offsetMs`. */
async function setClock(offsetMs) {
  const res = await fetch(`http://127.0.0.1:${MOCK_PORT}/__mock/clock?offsetMs=${offsetMs}`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error(`clock control failed: ${res.status}`);
  return res.json();
}

/* ------------------------------------------------------------ measurements */

/** Every actionable control at least 44px on its smaller axis. */
async function smallTargets(page, scope) {
  return page.evaluate((sel) => {
    const root = sel ? document.querySelector(sel) : document.body;
    if (!root) return [];
    const nodes = [...root.querySelectorAll('a, button, input, select, textarea, [type="submit"]')];
    return nodes
      .filter((n) => {
        // WCAG 2.5.5 / 2.5.8 exempt a link inside a sentence: padding an inline
        // link to 44px breaks the line box. The rule is about controls you aim at.
        if (n.tagName === 'A' && n.parentElement?.tagName === 'P') return false;
        const measured =
          (n.type === 'checkbox' || n.type === 'radio') && n.closest('label')
            ? n.closest('label')
            : n;
        const r = measured.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.height < 44;
      })
      .slice(0, 8)
      .map(
        (n) =>
          `${n.tagName.toLowerCase()}${n.type ? `[${n.type}]` : ''} h=${Math.round(
            n.getBoundingClientRect().height,
          )} "${(n.textContent ?? '').trim().slice(0, 30)}"`,
      );
  }, scope);
}

async function horizontalOverflow(page) {
  return page.evaluate(() => {
    const d = document.documentElement;
    return {
      scroll: d.scrollWidth,
      client: d.clientWidth,
      over: d.scrollWidth > d.clientWidth + 1,
    };
  });
}

/**
 * Controls whose box escapes the panel it lives in.
 *
 * Distinct from page overflow: a control can sit inside a page that does not
 * scroll sideways and still have its right edge cut off by an ancestor with
 * `overflow: hidden`, which is how a submit button becomes unpressable on a
 * narrow screen without anything measuring as broken.
 */
async function clippedControls(page, scope) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return ['panel missing'];
    const bounds = root.getBoundingClientRect();
    return [...root.querySelectorAll('a, button, input, select, textarea')]
      .filter((n) => {
        const r = n.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        // One pixel of tolerance for sub-pixel layout rounding.
        return r.left < bounds.left - 1 || r.right > bounds.right + 1;
      })
      .slice(0, 8)
      .map((n) => {
        const r = n.getBoundingClientRect();
        return `${n.tagName.toLowerCase()} "${(n.textContent ?? n.value ?? '')
          .toString()
          .trim()
          .slice(
            0,
            24,
          )}" left=${Math.round(r.left)} right=${Math.round(r.right)} panel=[${Math.round(
          bounds.left,
        )},${Math.round(bounds.right)}]`;
      });
  }, scope);
}

/** The checklist as rendered: one entry per line, with its mark. */
async function readChecklist(page) {
  return page.evaluate(() => {
    const heads = [...document.querySelectorAll('p')].filter((p) =>
      /^(Activation|Renewal) checklist$/.test((p.textContent ?? '').trim()),
    );
    if (heads.length === 0) return null;
    const card = heads[0].closest('div');
    const list = card?.querySelector('ul');
    if (!list) return null;
    const lines = [...list.querySelectorAll('li')].map((li) => {
      const spans = [...li.querySelectorAll(':scope > span')];
      const mark = (spans[0]?.textContent ?? '').trim();
      const body = spans[1];
      return {
        mark,
        label: (body?.querySelector('span:nth-child(1)')?.textContent ?? '').trim(),
        detail: (body?.querySelector('span:nth-child(2)')?.textContent ?? '').trim(),
      };
    });
    const text = card?.textContent ?? '';
    return {
      lines,
      // The activate control is a submit button inside the card, not a link.
      hasActivate: [...(card?.querySelectorAll('button') ?? [])].some((b) =>
        /^(Activate|Renew) featured listing$/.test((b.textContent ?? '').trim()),
      ),
      refusalShown: /cannot be activated yet/i.test(text),
      text,
    };
  });
}

/** An authenticated admin browser context at a given viewport. */
function adminContext(browser, viewport) {
  return browser.newContext({
    viewport,
    storageState: {
      cookies: [
        {
          name: 'tlws_admin',
          value: SESSION_TOKEN,
          domain: '127.0.0.1',
          path: '/',
          expires: -1,
          httpOnly: true,
          secure: false,
          sameSite: 'Lax',
        },
      ],
      origins: [],
    },
  });
}

/* --------------------------------------------------------------- processes */

function startMock(env) {
  return spawn('node', [path.join('scripts', 'bench', 'mock-postgrest.mjs')], {
    cwd: TREE,
    detached: true,
    env: {
      ...process.env,
      MOCK_PORT: String(MOCK_PORT),
      MOCK_REVENUE: '1',
      MOCK_FIRST_SALE: '1',
      MOCK_TEXT_PROFILE: 'production',
      // The production field profile sets the generated featured rate to ZERO,
      // which is the live state — so the only featured rows are the four
      // fixtures and nothing else can be mistaken for them.
      MOCK_FIELD_PROFILE: 'production',
      MOCK_FEATURED_FIXTURES: '1',
      MOCK_FEATURED_SCHEMA: 'ready',
      ...env,
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}

/**
 * A raw TCP connect, not a fetch: `fetch` can be satisfied by an outbound
 * proxy and report a dead port as alive.
 */
function portInUse(port) {
  return new Promise((resolve) => {
    const sock = net.connect({ host: '127.0.0.1', port });
    const done = (v) => {
      sock.destroy();
      resolve(v);
    };
    sock.once('connect', () => done(true));
    sock.once('error', () => done(false));
    sock.setTimeout(1000, () => done(false));
  });
}

/** Kill a child AND its descendants — npx does not forward signals. */
function killTree(child) {
  if (!child?.pid) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    try {
      child.kill('SIGTERM');
    } catch {
      /* already gone */
    }
  }
}

function startServer() {
  return spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: TREE,
    detached: true,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'mock-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'mock-service-role-key',
      NEXT_PUBLIC_SITE_URL: 'https://truckinglifewithshawn.com',
      ADMIN_PASSWORD: BENCH_ADMIN_PW,
      ADMIN_SESSION_SECRET: BENCH_SESSION_SEED,
      NO_PROXY: '*',
      no_proxy: '*',
    },
    stdio: ['ignore', 'inherit', 'inherit'],
  });
}

/* -------------------------------------------------------------------- main */

const reviewUrl = (base, params) =>
  `${base}/admin/directory/placements?${new URLSearchParams(params).toString()}`;

async function main() {
  const { chromium } = await import('playwright');

  if (await portInUse(MOCK_PORT)) {
    console.error(
      `refusing to run: something already listens on ${MOCK_PORT}; it would serve a different ` +
        'fixture set and every assertion below would describe it rather than this bench.',
    );
    process.exit(2);
  }
  const mock = startMock({});
  if (!(await waitFor(`http://127.0.0.1:${MOCK_PORT}/__mock/health`)))
    throw new Error('mock did not come up');

  const server = startServer();
  const base = `http://127.0.0.1:${PORT}`;
  if (!(await waitFor(`${base}/admin/login`))) throw new Error('next start did not come up');

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const consoleErrors = [];

  try {
    /* ======================================= A · the placement is live (in term) */
    section('A · a live placement, as the owner reads it');
    await setClock(3_600_000);

    for (const { w, h } of WIDTHS) {
      const ctx = await adminContext(browser, { width: w, height: h });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => consoleErrors.push(`${w}: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error' && isPageError(m.text())) consoleErrors.push(`${w}: ${m.text()}`);
      });

      await page.goto(`${base}/admin/directory/placements`, { waitUntil: 'networkidle' });
      const text = await page.locator(PANEL).innerText();

      check(`${w}: the live placement reads ACTIVATED in a word`, /ACTIVATED/.test(text));
      check(
        `${w}: the exact end date is on screen`,
        /Ends\s+\d{4}-\d{2}-\d{2}/.test(text),
        text.match(/Ends[^\n]{0,60}/)?.[0],
      );
      check(
        `${w}: days remaining are stated, not left to arithmetic`,
        /days? left|ended \d+ days? ago/.test(text),
      );
      check(
        `${w}: the term length is named`,
        /Term\s+(Monthly|Annual|Term length is recorded)/.test(text),
      );
      check(
        `${w}: the deal that paid for the placement is named`,
        /Paid by\s+Fixture Roadside Service/.test(text),
        text.match(/Paid by[^\n]{0,60}/)?.[0],
      );
      check(
        `${w}: what the public sees right now is stated in plain words`,
        /Labelled Sponsored, sorted first/.test(text),
      );
      check(`${w}: capacity in use is visible`, /truck-washes:\s*3\/3/.test(text), {
        found: text.match(/truck-washes:[^\n]{0,20}/)?.[0],
      });
      check(`${w}: a renewal control is offered`, /Renew this placement/.test(text));
      check(`${w}: a stop control is offered`, /Stop sponsorship/.test(text));
      check(
        `${w}: stopping states what it does NOT touch`,
        /never unpublishes the business/.test(text),
      );

      const small = await smallTargets(page, PANEL);
      check(`${w}: every control in the panel clears 44px`, small.length === 0, small);
      const clipped = await clippedControls(page, PANEL);
      check(`${w}: no control is clipped by its panel`, clipped.length === 0, clipped);
      const over = await horizontalOverflow(page);
      check(`${w}: the console does not scroll sideways`, !over.over, over);

      await ctx.close();
    }

    /* ============================= B · the search-and-prepare step writes nothing */
    section('B · find the business, prepare the sale');
    {
      const ctx = await adminContext(browser, { width: 1280, height: 800 });
      const page = await ctx.newPage();
      await page.goto(`${base}/admin/directory/placements?q=${encodeURIComponent(CANDIDATE)}`, {
        waitUntil: 'networkidle',
      });
      // Case-insensitively: the console renders listing names through a CSS
      // `uppercase` transform, and `innerText` reports the transformed text.
      check(
        'search: the candidate listing is found',
        (await page.locator(PANEL).innerText()).toLowerCase().includes(CANDIDATE.toLowerCase()),
      );

      // Drive the real control rather than hand-writing its URL, so the form
      // and the review step are proven to agree.
      await page.getByRole('button', { name: 'Prepare this sale' }).first().click();
      await page.waitForLoadState('networkidle');
      const url = new URL(page.url());
      check(
        'prepare: choosing a listing is a GET that writes nothing',
        url.searchParams.get('listing') === CANDIDATE_ID && url.pathname.endsWith('/placements'),
        page.url(),
      );
      const list = await readChecklist(page);
      check('prepare: the checklist renders on the same page', list !== null);
      check(
        'prepare: with no opportunity chosen the payment line refuses',
        list?.lines.find((l) => /Payment confirmed/.test(l.label))?.mark === 'NO',
        list?.lines,
      );
      check('prepare: no activate control is offered', list?.hasActivate === false);
      await ctx.close();
    }

    /* ================================ C · unsafe state — the page is already full */
    section('C · unsafe state: the page is already full');
    for (const { w, h } of WIDTHS) {
      const ctx = await adminContext(browser, { width: w, height: h });
      const page = await ctx.newPage();
      await page.goto(
        reviewUrl(base, { listing: CANDIDATE_ID, sale: PAID_OPPORTUNITY, billing: 'monthly' }),
        { waitUntil: 'networkidle' },
      );
      const list = await readChecklist(page);
      const capacity = list?.lines.find((l) => /Room on every page/.test(l.label));
      check(`${w}: full page — the capacity line refuses`, capacity?.mark === 'NO', capacity);
      check(
        `${w}: full page — the count is shown, not just a verdict`,
        /3\/3/.test(capacity?.detail ?? ''),
        capacity?.detail,
      );
      check(
        `${w}: full page — payment still reads as confirmed`,
        list?.lines.find((l) => /Payment confirmed/.test(l.label))?.mark === 'OK',
      );
      check(`${w}: full page — NO activate control exists`, list?.hasActivate === false);
      check(`${w}: full page — the refusal is explained`, list?.refusalShown === true);

      const small = await smallTargets(page, PANEL);
      check(`${w}: refused checklist — every control clears 44px`, small.length === 0, small);
      const clipped = await clippedControls(page, PANEL);
      check(`${w}: refused checklist — nothing is clipped`, clipped.length === 0, clipped);
      const over = await horizontalOverflow(page);
      check(`${w}: refused checklist — no sideways scroll`, !over.over, over);
      await ctx.close();
    }

    /* ================================ D · valid state — the slot has been released */
    section('D · valid state: the slot has been released');
    await setClock(-2000);

    for (const { w, h } of WIDTHS) {
      const ctx = await adminContext(browser, { width: w, height: h });
      const page = await ctx.newPage();
      await page.goto(
        reviewUrl(base, { listing: CANDIDATE_ID, sale: PAID_OPPORTUNITY, billing: 'monthly' }),
        { waitUntil: 'networkidle' },
      );
      const list = await readChecklist(page);
      check(
        `${w}: released slot — every line passes`,
        list !== null && list.lines.length === 12 && list.lines.every((l) => l.mark === 'OK'),
        list?.lines.filter((l) => l.mark !== 'OK'),
      );
      check(`${w}: released slot — the activate control is offered`, list?.hasActivate === true);
      check(
        `${w}: released slot — the exact date that will be written is shown`,
        /stops on \d{4}-\d{2}-\d{2}/.test(list?.text ?? ''),
        list?.text.match(/stops on[^.]{0,20}/)?.[0],
      );
      check(
        `${w}: released slot — the single-write guarantee is stated`,
        /no moment where it is sponsored with no expiry/.test(list?.text ?? ''),
      );
      check(
        `${w}: released slot — a lapsed placement is not counted against capacity`,
        /0\/3/.test(list?.lines.find((l) => /Room on every page/.test(l.label))?.detail ?? ''),
      );

      const small = await smallTargets(page, PANEL);
      check(`${w}: activatable checklist — every control clears 44px`, small.length === 0, small);
      const clipped = await clippedControls(page, PANEL);
      check(`${w}: activatable checklist — nothing is clipped`, clipped.length === 0, clipped);
      const over = await horizontalOverflow(page);
      check(`${w}: activatable checklist — no sideways scroll`, !over.over, over);
      await ctx.close();
    }

    /* ============================================ E · an unpaid deal is refused */
    section('E · an unpaid deal, and the picker');
    {
      const ctx = await adminContext(browser, { width: 390, height: 844 });
      const page = await ctx.newPage();
      await page.goto(
        reviewUrl(base, { listing: CANDIDATE_ID, sale: UNPAID_OPPORTUNITY, billing: 'monthly' }),
        { waitUntil: 'networkidle' },
      );
      const list = await readChecklist(page);
      const payment = list?.lines.find((l) => /Payment confirmed/.test(l.label));
      check('unpaid: the payment line refuses', payment?.mark === 'NO', payment);
      check('unpaid: no activate control exists', list?.hasActivate === false);
      check(
        'unpaid: the picker names the opportunity rather than asking for an id',
        (await page.locator(PANEL).innerText()).includes('Which opportunity paid for this?'),
      );
      const options = await page.locator('select[name="sale"] option').allInnerTexts();
      check(
        'unpaid: the picker shows each deal state so the right one is obvious',
        options.some((o) => /Fixture Roadside Service.*Closed won.*paid/.test(o)) &&
          options.some((o) => /Contacted.*unpaid/.test(o)),
        options,
      );
      await ctx.close();
    }

    /* ================================================ F · the billing mismatch */
    section('F · the term selected is not the term sold');
    {
      const ctx = await adminContext(browser, { width: 1280, height: 800 });
      const page = await ctx.newPage();
      await page.goto(
        reviewUrl(base, { listing: CANDIDATE_ID, sale: PAID_OPPORTUNITY, billing: 'annual' }),
        { waitUntil: 'networkidle' },
      );
      const list = await readChecklist(page);
      const billing = list?.lines.find((l) => /Billing period/.test(l.label));
      check(
        'mismatch: selling monthly and activating annual is refused',
        billing?.mark === 'NO',
        billing,
      );
      check('mismatch: no activate control exists', list?.hasActivate === false);
      await ctx.close();
    }

    /* ======================================================= G · renewal review */
    section('G · renewal, and what it costs');
    await setClock(12 * 86_400_000);
    for (const { w, h } of WIDTHS) {
      const ctx = await adminContext(browser, { width: w, height: h });
      const page = await ctx.newPage();
      await page.goto(
        reviewUrl(base, { renew: LIVE_ID, sale: PAID_OPPORTUNITY, billing: 'monthly' }),
        { waitUntil: 'networkidle' },
      );
      const list = await readChecklist(page);
      check(
        `${w}: renewal — the checklist renders and every line passes`,
        list !== null && list.lines.every((l) => l.mark === 'OK'),
        list?.lines.filter((l) => l.mark !== 'OK'),
      );
      check(`${w}: renewal — the renew control is offered`, list?.hasActivate === true);
      check(
        `${w}: renewal — the paid days it would replace are stated`,
        /still has \d+ paid days? left/.test(list?.text ?? '') && /REPLACES/.test(list?.text ?? ''),
        list?.text.match(/still has[^.]{0,90}/)?.[0],
      );
      check(
        `${w}: renewal — an existing placement is not counted against itself`,
        /2\/3/.test(list?.lines.find((l) => /Room on every page/.test(l.label))?.detail ?? ''),
        list?.lines.find((l) => /Room on every page/.test(l.label))?.detail,
      );
      const small = await smallTargets(page, PANEL);
      check(`${w}: renewal checklist — every control clears 44px`, small.length === 0, small);
      const clipped = await clippedControls(page, PANEL);
      check(`${w}: renewal checklist — nothing is clipped`, clipped.length === 0, clipped);
      const over = await horizontalOverflow(page);
      check(`${w}: renewal checklist — no sideways scroll`, !over.over, over);
      await ctx.close();
    }

    /* ============================== H · the public Directory, three fixtures */
    section('H · the public Directory: ordinary, active, expired');
    {
      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await ctx.newPage();

      /**
       * How the category page renders the fixture placements right now.
       *
       * TWO requests, and the measurement is on the second. The category page
       * is ISR: a request against a cold or stale entry serves what is cached
       * and regenerates behind it, so a single read reports the PREVIOUS
       * render — which on a freshly-built tree is the build-time prerender,
       * taken against whatever the mock's clock said then. Measuring the
       * second request is what makes this section independent of how the
       * cache was left by an earlier run.
       */
      const read = async () => {
        await page.goto(`${base}/directory/truck-washes`, { waitUntil: 'networkidle' });
        await sleep(1500);
        await page.goto(`${base}/directory/truck-washes`, { waitUntil: 'networkidle' });
        return page.evaluate(() => {
          const cards = [...document.querySelectorAll('div.rounded-card')].filter((d) =>
            d.querySelector(':scope > h3'),
          );
          const listed = [];
          const sponsored = [];
          for (const card of cards) {
            const m = (card.querySelector(':scope > h3')?.textContent ?? '').match(
              /Bench Featured Placement (\d)/,
            );
            if (!m) continue;
            listed.push(m[1]);
            if (
              [...card.querySelectorAll(':scope > span')].some(
                (s) => (s.textContent ?? '').trim() === 'Sponsored',
              )
            )
              sponsored.push(m[1]);
          }
          return {
            listed: [...new Set(listed)].sort(),
            sponsored: [...new Set(sponsored)].sort(),
            ordinaryCards: cards.length - new Set(listed).size,
            // The raw term must never reach the browser in any form.
            html: document.documentElement.innerHTML,
          };
        });
      };

      await setClock(3_600_000);
      const live = await read();
      check(
        'public: an active featured listing wears the Sponsored badge',
        live.sponsored.join(',') === '1,2,3',
        live.sponsored,
      );
      check(
        'public: an ordinary listing carries no Sponsored badge',
        live.ordinaryCards > 0 && !live.sponsored.includes('4'),
        { ordinary: live.ordinaryCards, sponsored: live.sponsored },
      );
      check(
        'public: the ordinary listing is still listed alongside the sponsored ones',
        live.listed.includes('4'),
        live.listed,
      );
      check(
        'public: no raw term reaches the browser while a placement is live',
        !/featured_?[Uu]ntil/.test(live.html) && !/paid_?[Cc]ents/.test(live.html),
      );

      /* The expired fixture, and the honest thing about how it gets there.
       *
       * The category page is ISR. Expiry is a READ rule with no write at the
       * moment it happens, so nothing purges that cache — a lapsed placement
       * keeps its badge on the prerendered page for up to one revalidation
       * window. REVENUE-2 measured that bound and it has not changed here, so
       * this asserts the bound is real rather than pretending the transition
       * is instant, then reads the surface where it IS instant, then waits the
       * window out to get a genuinely re-rendered expired page. */
      await setClock(-2000);
      const stale = await read();
      check(
        'public: the prerendered page is still stale right after the term passes (the ISR bound is real)',
        stale.sponsored.length === 3,
        stale.sponsored,
      );

      // The per-request surface has already dropped it — no cache between the
      // rule and the answer.
      const cards = await fetch(
        `${base}/api/directory/cards?ids=${[1, 2, 3, 4]
          .map((n) => `0f000000-0000-4000-8000-00000000000${n}`)
          .join(',')}`,
      ).then((r) => r.json());
      const list = Array.isArray(cards?.data?.cards) ? cards.data.cards : [];
      check(
        'public: on the per-request read path the sponsorship is already over',
        list.length === 4 && list.filter((c) => c.featured === true).length === 0,
        { returned: list.length, featured: list.filter((c) => c.featured === true).length },
      );
      check(
        'public: every business is still returned once its sponsorship ends',
        list.length === 4,
        list.length,
      );
      check(
        'public: the per-request payload carries no commercial field',
        !/featured_?[Uu]ntil|paid_?[Cc]ents|pledged_?[Cc]ents|tier_?[Ii]nterest/.test(
          JSON.stringify(cards),
        ),
      );

      const declared = fs
        .readFileSync(path.join(TREE, 'src/app/(directory)/directory/[category]/page.tsx'), 'utf8')
        .match(/export const revalidate = (\d+);/);
      const windowSeconds = declared ? Number(declared[1]) : null;
      check('public: the category page declares a revalidation window', windowSeconds !== null);

      if (process.env.BENCH_SKIP_ISR_WAIT === '1') {
        console.log(
          '    (skipping the timed wait for the rendered expired fixture — BENCH_SKIP_ISR_WAIT=1)',
        );
      } else {
        console.log(`    waiting ${windowSeconds + 10}s for one revalidation window…`);
        await sleep((windowSeconds + 10) * 1000);
        // `read()` already requests twice; the extra pass here covers the
        // regeneration the window itself triggers.
        await read();
        await sleep(3000);
        const expired = await read();
        check(
          'public: an expired featured listing loses the Sponsored badge',
          expired.sponsored.length === 0,
          expired.sponsored,
        );
        check(
          'public: an expired featured listing is STILL LISTED',
          ['1', '2', '3'].every((n) => expired.listed.includes(n)),
          expired.listed,
        );
        check(
          'public: expiry removes a label, never a business',
          expired.listed.length >= live.listed.length,
          { live: live.listed, expired: expired.listed },
        );
        check(
          'public: no raw term reaches the browser after expiry either',
          !/featured_?[Uu]ntil/.test(expired.html) && !/paid_?[Cc]ents/.test(expired.html),
        );
      }

      // The business must stay indexable — sponsorship ending is not an SEO event.
      const robots = await page.evaluate(
        () => document.querySelector('meta[name="robots"]')?.getAttribute('content') ?? '',
      );
      check(
        'public: an expired sponsorship does not noindex the page',
        !/noindex/i.test(robots),
        robots,
      );
      await ctx.close();
    }

    section('page health');
    check(
      'no page errors anywhere in the run',
      consoleErrors.length === 0,
      consoleErrors.slice(0, 5),
    );
    section('');
  } finally {
    await browser.close();
    killTree(server);
    killTree(mock);
  }

  console.log(`\nfirst-sale bench: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
