/**
 * REVENUE-1 — the public offer path and the admin revenue console in a real
 * browser, at the four widths that matter.
 *
 * Two things this cannot be replaced by a unit test for:
 *
 *   1. **Layout under real content.** The fixture pipeline carries a company
 *      name 74 characters long, because that is what breaks a table, and a live
 *      placement whose term lapsed three weeks ago, because that is the row
 *      that has to be unmissable on a 360px phone.
 *   2. **The absence of a shortcut.** The whole design of this milestone is a
 *      gated progression, and the assertion that matters is that the revenue
 *      console exposes no control that turns a placement on. That is a claim
 *      about rendered DOM, not about a function.
 *
 * Auth is minted directly rather than driven through the login form: the
 * session cookie is an HMAC of a fixed string under the session secret, so the
 * bench holds a valid session without a password round trip. The values are
 * throwaway and named so they cannot be mistaken for real ones.
 *
 * Usage:
 *   node scripts/bench/revenue-surfaces.mjs --tree .
 *
 * The tree must hold a production `.next` built against mock-postgrest with
 * MOCK_REVENUE=1.
 */
import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const TREE = arg('tree', '.');
const PORT = Number(arg('port', '3177'));

/**
 * `NEXT_PUBLIC_SUPABASE_URL` is INLINED AT BUILD TIME — Next replaces every
 * `process.env.NEXT_PUBLIC_*` read with a literal during compilation. So a
 * production server does not honour the variable you start it with: it talks to
 * whatever URL the build baked in. Read the baked-in port out of the build and
 * listen there, and refuse loudly on a mismatch rather than serving a mock
 * nobody calls.
 */
function bakedMockPort(tree) {
  const candidates = [
    '.next/server/app/admin/(dashboard)/directory/revenue/page.js',
    '.next/server/app/admin/(dashboard)/directory/placements/page.js',
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
const MOCK_PORT = Number(REQUESTED_MOCK_PORT ?? BAKED ?? 54993);
if (BAKED && REQUESTED_MOCK_PORT && Number(REQUESTED_MOCK_PORT) !== BAKED) {
  console.error(
    `refusing to run: the build talks to 127.0.0.1:${BAKED} (baked in at build time), ` +
      `but --mock-port ${REQUESTED_MOCK_PORT} was given. Rebuild against that port, or omit --mock-port.`,
  );
  process.exit(2);
}

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

/**
 * Console output this build emits for a reason that is not the page's.
 * `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is a deploy secret and is deliberately absent
 * from a local bench build, so the widget logs that it cannot render. Treating
 * that as a page defect keeps this assertion permanently red for something the
 * bench itself causes, which is how a real assertion gets deleted.
 */
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

/** Every actionable control is at least 44px on its smaller axis. */
async function smallTargets(page, scope) {
  return page.evaluate((sel) => {
    const root = sel ? document.querySelector(sel) : document.body;
    if (!root) return [];
    const nodes = [...root.querySelectorAll('a, button, input, select, textarea, [type="submit"]')];
    return nodes
      .filter((n) => {
        // A link inside a sentence is exempt. WCAG 2.5.5 / 2.5.8 both carve out
        // targets in a block of text, and for a good reason: padding an inline
        // link to 44px breaks the line box around it and makes the paragraph
        // harder to read, not easier. The rule is about controls you aim at,
        // and these are read, not aimed at.
        if (n.tagName === 'A' && n.parentElement?.tagName === 'P') return false;
        // For a checkbox or radio the label is the control you actually tap, so
        // that is what has to clear 44px — a 44px checkbox is not the fix.
        const measured =
          (n.type === 'checkbox' || n.type === 'radio') && n.closest('label')
            ? n.closest('label')
            : n;
        const r = measured.getBoundingClientRect();
        // Ignore anything not laid out (inside a closed <details>, hidden).
        return r.width > 0 && r.height > 0 && r.height < 44;
      })
      .slice(0, 8)
      .map(
        (n) =>
          `${n.tagName.toLowerCase()}${n.type ? `[${n.type}]` : ''} h=${Math.round(n.getBoundingClientRect().height)} "${(n.textContent ?? '').trim().slice(0, 30)}"`,
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

async function main() {
  const { chromium } = await import('playwright');

  const mock = spawn('node', [path.join('scripts', 'bench', 'mock-postgrest.mjs')], {
    cwd: TREE,
    env: {
      ...process.env,
      MOCK_PORT: String(MOCK_PORT),
      MOCK_REVENUE: '1',
      MOCK_TEXT_PROFILE: 'production',
      MOCK_FIELD_PROFILE: 'production',
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  // If something is already on the port, this bench's own mock never binds and
  // every assertion below silently describes a server nobody here configured —
  // a leftover from a previous run serves a different fixture set and the
  // results look plausible. Fail loudly instead.
  let mockFailed = null;
  mock.on('exit', (code) => {
    if (code !== 0 && code !== null) mockFailed = code;
  });
  if (!(await waitFor(`http://127.0.0.1:${MOCK_PORT}/__mock/health`))) {
    throw new Error('mock did not start');
  }
  await sleep(300);
  if (mockFailed !== null) {
    throw new Error(
      `refusing to run: this bench's mock exited (${mockFailed}) but 127.0.0.1:${MOCK_PORT} is ` +
        `answering, so something else is serving it. Stop the stale process and re-run.`,
    );
  }

  const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: TREE,
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
    stdio: ['ignore', 'ignore', 'inherit'],
  });

  const base = `http://127.0.0.1:${PORT}`;
  if (!(await waitFor(`${base}/admin/login`))) throw new Error('next start did not come up');

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  console.log('REVENUE-1 — public offer path + admin revenue console, real browser\n');

  try {
    /* ---------------------------------------------------- unauthenticated */
    {
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      const page = await ctx.newPage();
      const res = await page.goto(`${base}/admin/directory/revenue`, {
        waitUntil: 'domcontentloaded',
      });
      check('anon: the revenue console redirects to login', page.url().includes('/admin/login'), {
        url: page.url(),
        status: res?.status(),
      });
      const body = await page.locator('body').innerText();
      check(
        'anon: no CRM data leaks on the way out',
        !/Fixture Truck Wash|fixture-a@example|pledged|paid_cents/i.test(body),
      );
      await ctx.close();
    }

    for (const { w, h } of WIDTHS) {
      console.log(`— ${w}px —`);

      /* ============================================== PUBLIC: /sponsors */
      {
        const ctx = await browser.newContext({ viewport: { width: w, height: h } });
        const page = await ctx.newPage();
        const consoleErrors = [];
        page.on('console', (m) => {
          if (m.type() === 'error' && isPageError(m.text()))
            consoleErrors.push(m.text().slice(0, 140));
        });

        const res = await page.goto(`${base}/sponsors?interest=corridor-sponsor&from=i75`, {
          waitUntil: 'networkidle',
        });
        check(`${w}: /sponsors renders`, res.status() === 200, res.status());

        const body = await page.locator('body').innerText();
        check(
          `${w}: the offer table shows all three offers`,
          /Listing claim/i.test(body) &&
            /Featured listing/i.test(body) &&
            /Corridor sponsor/i.test(body),
        );
        check(`${w}: prices render`, /\$99/.test(body) && /\$2,999/.test(body));
        check(`${w}: sponsored disclosure stated`, /rel="sponsored"|carries rel/i.test(body));
        check(`${w}: no guarantee language`, !/\bguarantee/i.test(body));

        // The deep link preselects the offer and shows the source back.
        const interest = await page.locator('#sponsor_interest').inputValue();
        check(`${w}: offer preselected from the link`, interest === 'corridor-sponsor', interest);
        check(
          `${w}: the source is shown back, not hidden`,
          /Came from: i75/.test(body),
          body.match(/Came from: [^\n]*/)?.[0],
        );

        // Every form field is labelled and reachable.
        const unlabelled = await page.evaluate(() =>
          [...document.querySelectorAll('form input, form select, form textarea')]
            .filter((n) => {
              if (n.type === 'hidden') return false;
              const id = n.getAttribute('id');
              const labelled = id && document.querySelector(`label[for="${id}"]`);
              return !labelled && !n.getAttribute('aria-label') && !n.closest('label');
            })
            .map((n) => n.outerHTML.slice(0, 80)),
        );
        check(`${w}: every inquiry field is labelled`, unlabelled.length === 0, unlabelled);

        check(
          `${w}: the error region is aria-live`,
          (await page.locator('[aria-live="assertive"]').count()) >= 1,
        );

        const small = await smallTargets(page, 'form');
        check(`${w}: inquiry controls are at least 44px tall`, small.length === 0, small);

        const of = await horizontalOverflow(page);
        check(`${w}: /sponsors has no horizontal overflow`, !of.over, of);
        check(`${w}: /sponsors console is clean`, consoleErrors.length === 0, consoleErrors);

        // Keyboard: the submit button is reachable and shows a focus ring.
        const focusVisible = await page.evaluate(() => {
          const btn = [...document.querySelectorAll('button')].find((b) => b.type === 'submit');
          if (!btn) return null;
          btn.focus();
          const s = getComputedStyle(btn);
          return {
            focused: document.activeElement === btn,
            outline: s.outlineStyle !== 'none' || s.boxShadow !== 'none',
          };
        });
        check(`${w}: the submit button takes focus`, focusVisible?.focused === true, focusVisible);

        await ctx.close();
      }

      /* ================================ ADMIN: revenue console (populated) */
      {
        const ctx = await browser.newContext({ viewport: { width: w, height: h } });
        await ctx.addCookies([
          {
            name: 'tlws_admin',
            value: SESSION_TOKEN,
            domain: '127.0.0.1',
            path: '/',
            httpOnly: true,
            sameSite: 'Lax',
          },
        ]);
        const page = await ctx.newPage();
        const consoleErrors = [];
        page.on('console', (m) => {
          if (m.type() === 'error' && isPageError(m.text()))
            consoleErrors.push(m.text().slice(0, 140));
        });

        const url = `${base}/admin/directory/revenue`;
        const res = await page.goto(url, { waitUntil: 'networkidle' });
        check(
          `${w}: revenue console renders for an authed admin`,
          res.status() === 200,
          res.status(),
        );
        check(`${w}: not redirected to login`, !page.url().includes('/admin/login'));

        const body = await page.locator('body').innerText();

        /* the pipeline summary */
        check(`${w}: pipeline tiles render`, /Prospect/i.test(body) && /Closed won/i.test(body));
        check(`${w}: collected total renders`, /Collected/i.test(body));

        /* the overdue renewal — the row that has to be unmissable */
        check(
          `${w}: an overdue featured term says the placement is still showing`,
          /STILL SHOWING/i.test(body),
          body.match(/Term ended[^\n]*/)?.[0],
        );
        check(
          `${w}: the manual-expiry limitation is stated`,
          /does not/i.test(body) && /bare boolean|will NOT lapse|not lapse/i.test(body),
        );

        /* duplicates flagged */
        check(`${w}: duplicate opportunities are flagged`, /possible duplicate/i.test(body));

        /* paid-and-waiting */
        check(`${w}: paid deals awaiting activation are listed`, /ready to activate/i.test(body));

        /* the prospect shortlist */
        check(`${w}: the prospect shortlist renders`, /Who to call first/i.test(body));
        check(
          `${w}: the shortlist states what it does not know`,
          /no traffic estimate/i.test(body) && /likelihood[\s-]to[\s-]buy/i.test(body),
        );
        check(
          `${w}: the shortlist states truncation`,
          /Showing \d+ of \d+ eligible/.test(body) || /No eligible listing/.test(body),
          body.match(/Showing \d+ of \d+ eligible[^\n]*/)?.[0],
        );

        /* THE assertion: no control here turns a placement on */
        const activateControls = await page.evaluate(() => {
          const text = (n) => (n.textContent ?? '').trim().toLowerCase();
          return [...document.querySelectorAll('button, [type="submit"]')]
            .filter((n) => /\bactivate\b|\bgo live\b|\bpublish\b/.test(text(n)))
            .map((n) => (n.textContent ?? '').trim().slice(0, 40));
        });
        check(
          `${w}: the revenue console exposes no activation control`,
          activateControls.length === 0,
          activateControls,
        );
        const confirmWord = /type ACTIVATE/i.test(body);
        check(`${w}: no ACTIVATE confirmation lives on this console`, !confirmWord);

        /* no payment instrument field anywhere */
        const instrumentFields = await page.evaluate(() =>
          [...document.querySelectorAll('input')]
            .map((n) => `${n.name}|${n.getAttribute('autocomplete') ?? ''}`)
            .filter((s) => /card|cc-number|cvv|cvc|iban|routing|account_number/i.test(s)),
        );
        check(
          `${w}: no payment instrument field exists`,
          instrumentFields.length === 0,
          instrumentFields,
        );

        /* layout */
        const of = await horizontalOverflow(page);
        check(`${w}: revenue console has no horizontal overflow`, !of.over, of);

        const longName = await page.evaluate(() => {
          const cell = [...document.querySelectorAll('td')].find((n) =>
            (n.textContent ?? '').includes('Northern Georgia Corridor'),
          );
          if (!cell) return null;
          const r = cell.getBoundingClientRect();
          return { width: Math.round(r.width), height: Math.round(r.height) };
        });
        check(
          `${w}: a 74-character company name wraps instead of stretching the row`,
          longName !== null && longName.height > 20,
          longName,
        );

        check(
          `${w}: revenue console is aria-live for its result banner`,
          (await page.locator('[aria-live="polite"]').count()) >= 1,
        );
        check(`${w}: revenue console is clean`, consoleErrors.length === 0, consoleErrors);

        /* the open-deal panel: every step present, in order, 44px targets */
        // Navigate to the panel's own URL rather than click-and-wait: after a
        // click, `waitForLoadState('networkidle')` can resolve against the page
        // you were already on, and the assertions then read the old DOM.
        const firstManage = page.locator('a:has-text("Manage")').first();
        const manageHref = (await firstManage.count())
          ? await firstManage.getAttribute('href')
          : null;
        if (manageHref) {
          await page.goto(`${url}${manageHref}`, { waitUntil: 'networkidle' });
          // `innerText` returns text as CSS renders it, and these headings carry
          // `text-transform: uppercase` — so match case-insensitively or every
          // assertion against a styled heading silently fails.
          const panel = (await page.locator('body').innerText()).toLowerCase();
          const steps = [
            '1 · record a contact',
            '2 · qualification',
            '3 · move the stage',
            '4 · record the offer',
            '5 · record payment',
            '6 · record the term',
          ];
          const positions = steps.map((s) => panel.indexOf(s));
          check(
            `${w}: the deal panel shows every step`,
            positions.every((p) => p !== -1),
            steps.filter((_, i) => positions[i] === -1),
          );
          check(
            `${w}: the steps are in order`,
            positions.every((p, i) => i === 0 || p > positions[i - 1]),
            positions,
          );
          check(
            `${w}: the payment step warns against typing card details`,
            /never type a card number/.test(panel),
          );
          check(
            `${w}: the stage control only offers the next legal stage`,
            !/Closed won/.test(
              await page
                .locator('select[name="stage"]')
                .innerText()
                .catch(() => ''),
            ),
          );
          const smallAdmin = await smallTargets(page, 'section');
          check(
            `${w}: deal-panel controls are at least 44px tall`,
            smallAdmin.length === 0,
            smallAdmin,
          );
          const of2 = await horizontalOverflow(page);
          check(`${w}: the deal panel has no horizontal overflow`, !of2.over, of2);
        } else {
          check(`${w}: a deal can be opened`, false, 'no Manage link found');
        }

        await ctx.close();
      }

      /* ============================== ADMIN: placements console (the gate) */
      {
        const ctx = await browser.newContext({ viewport: { width: w, height: h } });
        await ctx.addCookies([
          {
            name: 'tlws_admin',
            value: SESSION_TOKEN,
            domain: '127.0.0.1',
            path: '/',
            httpOnly: true,
            sameSite: 'Lax',
          },
        ]);
        const page = await ctx.newPage();
        const res = await page.goto(`${base}/admin/directory/placements`, {
          waitUntil: 'networkidle',
        });
        check(`${w}: placements console renders`, res.status() === 200, res.status());

        const body = await page.locator('body').innerText();
        check(
          `${w}: the corridor form requires the paying CRM row`,
          /CRM row id \(required\)/i.test(body),
        );
        const required = await page.evaluate(() => {
          const el = document.querySelector('input[name="sponsor_id"]');
          return el ? el.hasAttribute('required') : null;
        });
        check(`${w}: the CRM row id input is marked required`, required === true, required);
        check(
          `${w}: the public preview is shown before activation`,
          /what the public sees/i.test(body),
        );
        check(
          `${w}: the blank-corridor wildcard is refused in copy`,
          /every corridor page/i.test(body),
        );
        check(
          `${w}: term-expired and placement-hidden are distinguished`,
          /two different\s+things/i.test(body.replace(/\s+/g, ' ')) ||
            /two different things/i.test(body),
        );

        const of = await horizontalOverflow(page);
        check(`${w}: placements console has no horizontal overflow`, !of.over, of);
        await ctx.close();
      }
    }

    /* ---------------------------------- empty state, exactly as production */
    console.log('— empty pipeline (production state: zero CRM rows) —');
    {
      // Restart the mock without the revenue fixtures so `sponsors` answers [],
      // which is what the owner actually sees today.
      mock.kill('SIGTERM');
      await sleep(400);
      const emptyMock = spawn('node', [path.join('scripts', 'bench', 'mock-postgrest.mjs')], {
        cwd: TREE,
        env: {
          ...process.env,
          MOCK_PORT: String(MOCK_PORT),
          MOCK_TEXT_PROFILE: 'production',
          // Same field profile as the populated run: the ONLY difference between
          // the two is MOCK_REVENUE, so an empty-state failure is about the
          // empty pipeline and not about a listing fixture with no phone number.
          MOCK_FIELD_PROFILE: 'production',
        },
        stdio: ['ignore', 'ignore', 'inherit'],
      });
      if (!(await waitFor(`http://127.0.0.1:${MOCK_PORT}/__mock/health`)))
        throw new Error('empty mock did not start');

      const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
      await ctx.addCookies([
        {
          name: 'tlws_admin',
          value: SESSION_TOKEN,
          domain: '127.0.0.1',
          path: '/',
          httpOnly: true,
          sameSite: 'Lax',
        },
      ]);
      const page = await ctx.newPage();
      await page.goto(`${base}/admin/directory/revenue`, { waitUntil: 'networkidle' });
      const body = await page.locator('body').innerText();
      check('empty: says there are no inquiries', /No inquiries yet/i.test(body));
      check(
        'empty: refuses to invent a conversion rate',
        /invented number/i.test(body) && !/\b0%/.test(body),
        body.match(/[^\n]*invented[^\n]*/)?.[0],
      );
      check('empty: says nothing can be due', /nothing can be due/i.test(body));
      check(
        'empty: the shortlist still gives the owner someone to call',
        /Who to call first/i.test(body) && /Showing \d+ of \d+ eligible/.test(body),
      );
      await ctx.close();
      emptyMock.kill('SIGTERM');
    }

    console.log(`\nrevenue-surfaces: ${passed} passed, ${failed} failed`);
  } finally {
    await browser.close();
    server.kill('SIGTERM');
    mock.kill('SIGTERM');
  }

  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
