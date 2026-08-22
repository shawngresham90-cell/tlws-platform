/**
 * REVENUE-4 — the daily revenue queue, in a real browser on a real server.
 *
 * WHAT ONLY THIS CAN PROVE
 *
 * The deterministic harness (scripts/test-revenue-money-queue.ts) pins the
 * RULES: which pile a row lands in and which pile outranks which. It cannot
 * show that the page an owner opens on a phone between calls actually RENDERS
 * that order — that a paid customer is above the fold rather than below six
 * cold leads, that the amount and the next step are legible at 360 CSS pixels,
 * that "Overdue" is a word and not just a red tint, or that the activation
 * handoff is a link you can hit with a thumb. Those are facts about a rendered
 * page, and a rule test passes throughout a page showing none of them.
 *
 * Usage:
 *   node scripts/bench/revenue-queue.mjs --tree .
 *
 * Needs a production `.next` built against mock-postgrest with the revenue
 * fixtures served, and Playwright (not a repository dependency — link or
 * install it for the run):
 *
 *   MOCK_PORT=54994 MOCK_REVENUE=1 MOCK_FIRST_SALE=1 MOCK_FEATURED_FIXTURES=1 \
 *   MOCK_FEATURED_SCHEMA=ready MOCK_TEXT_PROFILE=production \
 *   MOCK_FIELD_PROFILE=production node scripts/bench/mock-postgrest.mjs &
 *   curl -X POST 'http://127.0.0.1:54994/__mock/clock?offsetMs=1728000000'
 *   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54994 … npx next build
 *
 * The clock offset puts the fixture placements twenty days out, which is inside
 * the renewal lead window — that is what makes the renewal section, and the
 * Model B cost warning, reachable from a browser at all.
 *
 * BUILD FRESH FOR EACH RUN and never hand-delete `.next/cache`; both rules are
 * the ISR facts written up in scripts/bench/first-sale.mjs, and they cost a
 * debugging cycle there.
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
const PORT = Number(arg('port', '3183'));

/** `NEXT_PUBLIC_SUPABASE_URL` is inlined at build time; listen where it points. */
function bakedMockPort(tree) {
  const candidates = [
    '.next/server/app/admin/(dashboard)/directory/revenue/page.js',
    '.next/server/app/admin/(dashboard)/directory/placements/page.js',
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

const MOCK_PORT = Number(arg('mock-port', null) ?? bakedMockPort(TREE) ?? 54994);

const REVENUE = '/admin/directory/revenue';
/** The revenue panel itself, not the admin shell around it. */
const PANEL = 'div.max-w-5xl';

const WIDTHS = [
  { w: 360, h: 740 },
  { w: 390, h: 844 },
  { w: 430, h: 932 },
  { w: 1280, h: 800 },
];

/** Throwaway credentials for the local server this bench starts. Not real. */
const BENCH_ADMIN_PW = 'not-a-real-password-local-bench-only';
const BENCH_SESSION_SEED = 'not-a-real-secret-local-bench-only';
const SESSION_TOKEN = createHmac('sha256', BENCH_SESSION_SEED)
  .update('tlws-admin-session-v1')
  .digest('hex');

const KNOWN_BUILD_ENV_WARNINGS = [/NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set in this build/];
const isPageError = (t) => !KNOWN_BUILD_ENV_WARNINGS.some((re) => re.test(t));

let passed = 0;
let failed = 0;
const check = (name, cond, detail) => {
  if (cond) passed++;
  else {
    failed++;
    console.log(`  FAIL: ${name}`, detail === undefined ? '' : JSON.stringify(detail));
  }
};

let sectionMark = 0;
function section(title) {
  if (passed + failed > sectionMark) console.log(`    (${passed + failed - sectionMark} checks)`);
  sectionMark = passed + failed;
  if (title) console.log(`\n— ${title} —`);
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

/* ------------------------------------------------------------ measurements */

/** Every actionable control at least 44px on its smaller axis. */
async function smallTargets(page, scope) {
  return page.evaluate((sel) => {
    const root = sel ? document.querySelector(sel) : document.body;
    if (!root) return ['panel missing'];
    return [...root.querySelectorAll('a, button, input, select, textarea, [type="submit"]')]
      .filter((n) => {
        // WCAG exempts a link inside a sentence — padding it to 44px breaks the
        // line box. The rule is about controls you aim at.
        if (n.tagName === 'A' && n.parentElement?.tagName === 'P') return false;
        const r = n.getBoundingClientRect();
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

/** Controls whose box escapes the panel — clipped without the page scrolling. */
async function clipped(page, scope) {
  return page.evaluate((sel) => {
    const root = document.querySelector(sel);
    if (!root) return ['panel missing'];
    const b = root.getBoundingClientRect();
    return [...root.querySelectorAll('a, button, input, select, textarea')]
      .filter((n) => {
        const r = n.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        return r.left < b.left - 1 || r.right > b.right + 1;
      })
      .slice(0, 6)
      .map((n) => `${n.tagName.toLowerCase()} "${(n.textContent ?? '').trim().slice(0, 24)}"`);
  }, scope);
}

/**
 * The Today's Money queue as rendered: each card's business, its state word,
 * its amount line, its next-step line, and its vertical position.
 *
 * Anchored on the section heading rather than on a class, so a styling change
 * does not silently make this measure the wrong list.
 */
async function readQueue(page) {
  return page.evaluate(() => {
    const heads = [...document.querySelectorAll('h2')];
    const h = heads.find((x) => /Today.s money/i.test(x.textContent ?? ''));
    if (!h) return null;
    // The queue is the first <ul> after the heading, before the next <h2>.
    let node = h.nextElementSibling;
    let list = null;
    while (node && node.tagName !== 'H2') {
      if (node.tagName === 'UL') {
        list = node;
        break;
      }
      const inner = node.querySelector?.('ul');
      if (inner) {
        list = inner;
        break;
      }
      node = node.nextElementSibling;
    }
    const emptyText = list ? '' : (h.nextElementSibling?.textContent ?? '');
    return {
      heading: (h.textContent ?? '').trim(),
      empty: !list,
      emptyText,
      cards: list
        ? [...list.children].map((li) => {
            const r = li.getBoundingClientRect();
            const ps = [...li.querySelectorAll('p')].map((p) => (p.textContent ?? '').trim());
            return {
              company: (li.querySelector('p')?.textContent ?? '').trim(),
              text: (li.textContent ?? '').replace(/\s+/g, ' ').trim(),
              top: Math.round(r.top + window.scrollY),
              right: Math.round(r.right),
              lines: ps,
              hasActivate: [...li.querySelectorAll('a')].some((a) =>
                /Activate this placement/i.test(a.textContent ?? ''),
              ),
              activateHref:
                [...li.querySelectorAll('a')]
                  .find((a) => /Activate this placement/i.test(a.textContent ?? ''))
                  ?.getAttribute('href') ?? null,
            };
          })
        : [],
    };
  });
}

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
      MOCK_FIELD_PROFILE: 'production',
      MOCK_FEATURED_FIXTURES: '1',
      MOCK_FEATURED_SCHEMA: 'ready',
      ...env,
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
}

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

function killTree(child) {
  if (!child?.pid) return;
  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    try {
      child.kill('SIGTERM');
    } catch {
      /* gone */
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
  // Twenty days out: inside the renewal lead window, so the renewal section and
  // the Model B cost warning are both reachable.
  await fetch(`http://127.0.0.1:${MOCK_PORT}/__mock/clock?offsetMs=${20 * 86_400_000}`, {
    method: 'POST',
  });

  const server = startServer();
  const base = `http://127.0.0.1:${PORT}`;
  if (!(await waitFor(`${base}/admin/login`))) throw new Error('next start did not come up');

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const consoleErrors = [];

  try {
    /* ==================== A · the queue, as the owner sees it, at four widths */
    section("A · Today's money at four widths");
    for (const { w, h } of WIDTHS) {
      const ctx = await adminContext(browser, { width: w, height: h });
      const page = await ctx.newPage();
      page.on('pageerror', (e) => consoleErrors.push(`${w}: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error' && isPageError(m.text())) consoleErrors.push(`${w}: ${m.text()}`);
      });
      await page.goto(`${base}${REVENUE}`, { waitUntil: 'networkidle' });

      const q = await readQueue(page);
      check(`${w}: the Today's money section renders`, q !== null && !q.empty, q?.emptyText);
      check(`${w}: it has work in it`, (q?.cards.length ?? 0) > 0, q?.cards.length);

      const text = await page.locator(PANEL).innerText();

      // THE COMMERCIAL RULE: a paid customer is not buried under cold prospects.
      const paidIdx = q.cards.findIndex((c) => c.hasActivate);
      check(
        `${w}: a paid customer is in the queue`,
        paidIdx > -1,
        q.cards.map((c) => c.company),
      );
      check(`${w}: the paid customer is FIRST`, paidIdx === 0, {
        order: q.cards.map((c) => c.company.slice(0, 28)),
      });
      check(`${w}: the paid customer is above the fold`, q.cards[0].top < h, {
        top: q.cards[0].top,
        viewport: h,
      });

      // Each card answers the five questions without opening anything.
      const first = q.cards[0];
      check(`${w}: 1 · who — the business is named`, first.company.length > 2, first.company);
      check(
        `${w}: 2 · what — the product is named`,
        /Featured listing|Corridor sponsor|No offer recorded/.test(first.text),
        first.lines,
      );
      check(
        `${w}: 3 · how much — an amount is shown`,
        /\$[\d,]+|No amount recorded/.test(first.text),
        first.lines,
      );
      check(
        `${w}: 4 · where — the state is a word`,
        /Paid|Said yes|Quoted|New lead|Live|Overdue|Follow up/i.test(first.text),
        first.lines,
      );
      check(
        `${w}: 5 · what next — a next step is stated`,
        /Overdue|Due today|Scheduled|No next step set/.test(first.text),
        first.lines,
      );

      // Overdue must be readable without relying on colour.
      check(
        `${w}: overdue state is carried by a word, not colour alone`,
        /Overdue/.test(text),
        text.slice(0, 120),
      );

      // The handoff.
      check(
        `${w}: the paid card offers the activation handoff`,
        first.hasActivate && (first.activateHref ?? '').includes('/admin/directory/placements'),
        first.activateHref,
      );
      check(
        `${w}: the handoff carries the opportunity`,
        q.cards.filter((c) => c.hasActivate).every((c) => (c.activateHref ?? '').includes('sale=')),
        q.cards.filter((c) => c.hasActivate).map((c) => c.activateHref),
      );

      // Layout.
      const small = await smallTargets(page, PANEL);
      check(`${w}: every control in the panel clears 44px`, small.length === 0, small);
      const clip = await clipped(page, PANEL);
      check(`${w}: no control is clipped by the panel`, clip.length === 0, clip);
      const over = await horizontalOverflow(page);
      check(`${w}: the console does not scroll sideways`, !over.over, over);
      check(
        `${w}: no opportunity card overflows the panel`,
        q.cards.every((c) => c.right <= w + 1),
        q.cards.filter((c) => c.right > w + 1).map((c) => c.company),
      );

      await ctx.close();
    }

    /* ================================================ B · the rest of the page */
    section('B · summary, renewals, filters');
    {
      const ctx = await adminContext(browser, { width: 390, height: 844 });
      const page = await ctx.newPage();
      await page.goto(`${base}${REVENUE}`, { waitUntil: 'networkidle' });
      const text = await page.locator(PANEL).innerText();

      for (const tile of [
        'New leads',
        'Follow up today',
        'Overdue follow-up',
        'Quoted',
        'Said yes — not paid',
        'Paid — activate now',
        'Live',
        'Renewals due',
        'No next step set',
      ]) {
        check(`summary names "${tile}"`, text.includes(tile.toUpperCase()) || text.includes(tile), {
          tile,
        });
      }

      check('the renewal section renders', /Renewals and expiry/i.test(text));
      check(
        'a renewal states its standing in words',
        /Renewal approaching|Renewal due|Ended — needs contact/i.test(text),
        text.match(/Renewal[^\n]{0,40}/)?.[0],
      );
      check(
        'a running term states what renewing today would cost',
        /Renewing today replaces the \d+ paid day/i.test(text),
        text.match(/Renewing today[^\n]{0,80}/)?.[0],
      );
      check('the filter controls render', /Business.*Pile.*Product.*Follow-up/is.test(text));

      // The stale REVENUE-3 instruction must be gone.
      check(
        'the console no longer asks for a copied CRM row id',
        !/Copy this CRM row id/i.test(text),
      );

      await ctx.close();
    }

    /* ==================================================== C · filtering works */
    section('C · filtering');
    {
      const ctx = await adminContext(browser, { width: 1280, height: 800 });
      const page = await ctx.newPage();
      await page.goto(`${base}${REVENUE}?bucket=ready-to-activate`, { waitUntil: 'networkidle' });
      const filteredText = await page.locator(PANEL).innerText();
      check(
        'filtering by pile narrows the full list',
        /All opportunities \(\d+ of \d+\)/i.test(filteredText),
        filteredText.match(/All opportunities[^\n]*/)?.[0],
      );

      await page.goto(`${base}${REVENUE}?q=zzzznotabusiness`, { waitUntil: 'networkidle' });
      const noneText = await page.locator(PANEL).innerText();
      check(
        'a filter matching nothing says so and offers a way back',
        /Nothing matches that filter/i.test(noneText),
      );
      await ctx.close();
    }

    /* =============================== D · the handoff performs no write at all */
    section('D · the handoff writes nothing');
    {
      const ctx = await adminContext(browser, { width: 390, height: 844 });
      const page = await ctx.newPage();
      await page.goto(`${base}${REVENUE}`, { waitUntil: 'networkidle' });
      const q = await readQueue(page);
      // The featured handoff is the one with a checklist on the other side; a
      // corridor deal lands on its own activation form instead. Both are
      // asserted, each against what it actually reaches.
      const hrefs = q.cards.filter((c) => c.hasActivate).map((c) => c.activateHref ?? '');
      const href = hrefs.find((h) => h.includes('#review')) ?? hrefs[0];
      const corridorHref = hrefs.find((h) => h.includes('#corridor'));
      check(
        'a corridor handoff also carries its opportunity',
        !corridorHref || corridorHref.includes('sale='),
        corridorHref,
      );
      check('a handoff link exists to follow', Boolean(href), href);

      // What the placement looks like BEFORE following the link.
      const beforeRows = await fetch(
        `http://127.0.0.1:${MOCK_PORT}/rest/v1/locations?select=id,is_featured,featured_until&is_featured=eq.true`,
      ).then((r) => r.json());

      const writes = [];
      page.on('request', (r) => {
        if (['POST', 'PATCH', 'PUT', 'DELETE'].includes(r.method()))
          writes.push(`${r.method()} ${r.url()}`);
      });
      await page.goto(`${base}${href}`, { waitUntil: 'networkidle' });
      const landed = await page.locator('div.max-w-4xl').innerText();

      check(
        'the handoff lands on the placements console, ready to act',
        /Activation checklist|Renewal checklist|Activate a corridor sponsor/i.test(landed),
        landed.slice(0, 160),
      );
      check('the handoff issued no write request from the browser', writes.length === 0, writes);

      const afterRows = await fetch(
        `http://127.0.0.1:${MOCK_PORT}/rest/v1/locations?select=id,is_featured,featured_until&is_featured=eq.true`,
      ).then((r) => r.json());
      check(
        'no placement changed as a result of the handoff',
        JSON.stringify(beforeRows) === JSON.stringify(afterRows),
        { before: beforeRows?.length, after: afterRows?.length },
      );
      await ctx.close();
    }

    /* ================================ E · the empty CRM tells the owner what to do */
    section('E · the empty pipeline');
    {
      // Restart the mock with the CRM off — the LIVE production state.
      killTree(mock);
      await sleep(1500);
      const emptyMock = startMock({ MOCK_REVENUE: '0' });
      if (!(await waitFor(`http://127.0.0.1:${MOCK_PORT}/__mock/health`)))
        throw new Error('empty mock did not come up');

      const ctx = await adminContext(browser, { width: 360, height: 740 });
      const page = await ctx.newPage();
      await page.goto(`${base}${REVENUE}`, { waitUntil: 'networkidle' });
      const text = await page.locator(PANEL).innerText();

      check(
        'an empty pipeline is stated, not left blank',
        /Nothing in the pipeline yet/i.test(text),
      );
      check('it says this is not an error', /this is not an error/i.test(text));
      check('it names step one — pick someone to call', /Pick someone to call/i.test(text));
      check('it names step two — open the opportunity', /Open the opportunity here/i.test(text));
      check('the form to open one by hand is on the page', /Open an opportunity/i.test(text));
      check(
        'and it says nobody is contacted',
        /contacts nobody|nothing is sent, nobody is contacted/i.test(text),
      );

      const small = await smallTargets(page, PANEL);
      check('empty state: every control clears 44px', small.length === 0, small);
      const over = await horizontalOverflow(page);
      check('empty state: no sideways scroll at 360', !over.over, over);
      await ctx.close();
      killTree(emptyMock);
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

  console.log(`\nrevenue-queue bench: ${passed} passed, ${failed} failed`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
