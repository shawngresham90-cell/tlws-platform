/**
 * DIRECTORY REVENUE FUNNEL — end-to-end verification against a real local
 * production server. Boots `next start`, drives headless Chromium, and asserts
 * the things the offline harnesses cannot: accessibility, mobile overflow,
 * keyboard reachability, that a hostile query string cannot execute, that the
 * form fails and retries safely, that the funnel survives analytics being
 * broken, that every internal link resolves, and — the one that protects
 * revenue — that every price on every surface is one of the approved figures.
 *
 * The directory's data pages need Supabase. In an environment with no route to
 * the database they render empty and detail pages 404, so the listing funnel is
 * audited from its own server-rendered markup with the production CSS instead
 * of from a live detail page. That is stated in the output, never hidden.
 *
 * Prereq: `npm run build`, and Playwright available. Then:
 *   node scripts/e2e-directory-revenue.mjs
 */
import { spawn, execFileSync } from 'node:child_process';
import { createHmac, randomUUID } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const PORT = 3126;
const BASE = `http://127.0.0.1:${PORT}`;

// The approved offer prices, plus the savings derived from them. Anything else
// appearing as a dollar figure on a public surface is a bug.
const APPROVED = new Set(['$99', '$999', '$299', '$2,999', '$189', '$589']);

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
    // Not a project dependency; fall back to a globally installed Playwright,
    // which only exposes a CJS default export.
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

/**
 * Server-render the listing funnel on its own, with the built stylesheet, so it
 * can be audited without a database. Returns a file:// URL.
 */
async function renderFunnelPage() {
  // Inside the project, not the system temp dir: the bundle keeps react and
  // react-dom external, so it has to sit somewhere node_modules resolves from.
  const dir = mkdtempSync(join(process.cwd(), '.next', 'cache', 'tlws-e2e-'));
  const bundle = join(dir, 'funnel.mjs');
  execFileSync(
    'npx',
    [
      'esbuild',
      'src/components/directory/ListingFunnelCtas.tsx',
      '--bundle',
      '--platform=node',
      '--format=esm',
      '--jsx=automatic',
      '--alias:@=./src',
      '--alias:server-only=./scripts/shims/server-only.ts',
      '--alias:next/link=./scripts/shims/next-link.tsx',
      '--external:react',
      '--external:react-dom',
      `--outfile=${bundle}`,
      '--log-level=error',
    ],
    { stdio: 'inherit' },
  );
  const { ListingFunnelCtas } = await import(pathToFileURL(bundle).href);
  const markup = renderToStaticMarkup(
    createElement(ListingFunnelCtas, {
      listing: {
        id: '00000000-0000-0000-0000-000000000000',
        slug: 'snider-fleet-solutions-florence-florence-sc',
        name: 'Snider Fleet Solutions - Florence',
        category: 'tire-repair',
        state: 'SC',
        interstate: 'I-95',
      },
      surface: 'directory-listing',
    }),
  );
  const css = readdirSync('.next/static/css')
    .map((f) => readFileSync(join('.next/static/css', f), 'utf8'))
    .join('\n');
  const file = join(dir, 'funnel.html');
  writeFileSync(
    file,
    `<!doctype html><html lang="en"><head><meta charset="utf-8">` +
      `<meta name="viewport" content="width=device-width,initial-scale=1">` +
      `<title>Listing funnel</title><style>${css}</style></head>` +
      `<body class="bg-asphalt text-ink"><main class="mx-auto max-w-content px-5 py-10">` +
      `<h1 class="display-section">Listing</h1>${markup}</main></body></html>`,
  );
  return pathToFileURL(file).href;
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

const funnelUrl = await renderFunnelPage();

/**
 * The admin gate fails closed when ADMIN_PASSWORD / ADMIN_SESSION_SECRET are
 * unset, which is the correct behaviour and also means the admin pages cannot
 * be exercised at all. So this run generates a throwaway pair for the child
 * server only. They are random per run, never printed, never written to disk,
 * and never leave this process — a test fixture, not a credential.
 */
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || randomUUID();
const ADMIN_SESSION_SECRET = process.env.ADMIN_SESSION_SECRET || randomUUID();

// A server left running by a previous invocation would answer with that run's
// throwaway password and fail authentication for no real reason. Refuse to
// start rather than produce a confusing failure.
try {
  await fetch(`${BASE}/sponsors`, { signal: AbortSignal.timeout(1500) });
  console.error(
    `Port ${PORT} is already serving. Stop the stale server first — this run cannot ` +
      `authenticate against it.`,
  );
  process.exit(2);
} catch {
  /* nothing listening, which is what we want */
}

// `npx` forks the real server, so kill the whole process group at the end.
const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
  cwd: process.cwd(),
  stdio: ['ignore', 'pipe', 'pipe'],
  env: { ...process.env, ADMIN_PASSWORD, ADMIN_SESSION_SECRET },
  detached: true,
});
server.stdout.on('data', () => {});
server.stderr.on('data', () => {});

let browser;
try {
  await waitForServer(`${BASE}/sponsors`);
  const chromium = await loadChromium();
  browser = await chromium.launch();

  const PAGES = [
    ['sponsors', '/sponsors'],
    [
      'sponsors+listing context',
      '/sponsors?interest=featured-listing&listing=snider-fleet-solutions-florence-florence-sc' +
        '&lname=snider-fleet-solutions&lcat=tire-repair&lstate=SC&lcorr=i95&from=directory-listing',
    ],
    ['directory hub', '/directory'],
    ['category', '/directory/tire-repair'],
  ];

  /* ------------------------------------------------ a11y + mobile overflow */
  for (const [name, url] of PAGES) {
    for (const [w, h] of [
      [390, 844],
      [1280, 900],
    ]) {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      const errors = [];
      page.on('console', (m) => {
        // A local build has no Turnstile site key; the widget says so loudly on
        // purpose. That is configuration, not a defect. Nothing else is ignored.
        if (m.type() === 'error' && !/NEXT_PUBLIC_TURNSTILE_SITE_KEY/.test(m.text()))
          errors.push(m.text());
      });
      const res = await page.goto(BASE + url, { waitUntil: 'networkidle' });
      check(`${name} @${w}: 200`, res.status() === 200, res.status());
      const v = await axeViolations(page);
      check(
        `${name} @${w}: no serious/critical a11y violations`,
        v.length === 0,
        v.map((x) => `${x.id}(${x.nodes.length})`).join(', '),
      );
      check(`${name} @${w}: no horizontal overflow`, !(await overflows(page)));
      check(`${name} @${w}: no console errors`, errors.length === 0, errors[0]);
      await ctx.close();
    }
  }

  /* ----------------------------------------------------- pricing integrity */
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/sponsors`, { waitUntil: 'networkidle' });
    const text = await page.evaluate(() => document.body.innerText);
    const shown = [...new Set(text.match(/\$[\d,]+/g) ?? [])];
    check(
      'sponsors: every price is an approved figure',
      shown.length > 0 && shown.every((p) => APPROVED.has(p)),
      shown.join(' '),
    );
    check('sponsors: featured price stated', text.includes('$99/month or $999/year'));
    check('sponsors: corridor price stated', text.includes('$299/month or $2,999/year'));
    check('sponsors: featured capacity stated', /up to three/i.test(text));
    check('sponsors: corridor capacity stated', /one primary sponsor/i.test(text));
    check('sponsors: framed as an inquiry', /does not take payment/i.test(text));
    check('sponsors: no guarantee', !/guarantee/i.test(text));
    check('sponsors: no manufactured scarcity', !/spots? left|only \d+ spot|hurry/i.test(text));
    await ctx.close();
  }

  /* ------------------------------- listing funnel (rendered without the DB) */
  console.log(
    'note: the listing funnel is audited from server-rendered markup — a local ' +
      'server has no database, so directory detail pages 404 here.',
  );
  for (const [w, h] of [
    [390, 844],
    [1280, 900],
  ]) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage();
    await page.goto(funnelUrl);
    const v = await axeViolations(page);
    check(
      `funnel @${w}: no serious/critical a11y violations`,
      v.length === 0,
      v.map((x) => `${x.id}(${x.nodes.length})`).join(', '),
    );
    check(`funnel @${w}: no horizontal overflow`, !(await overflows(page)));
    const t = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    const shown = [...new Set(t.match(/\$[\d,]+/g) ?? [])];
    check(
      `funnel @${w}: only the featured price appears`,
      shown.every((p) => p === '$99' || p === '$999'),
      shown.join(' '),
    );
    check(`funnel @${w}: claiming is stated free`, /Claiming is free/i.test(t));
    check(`funnel @${w}: capacity stated`, /up to three featured businesses/i.test(t));
    check(`funnel @${w}: no guarantee`, !/guarantee/i.test(t));
    check(`funnel @${w}: no manufactured scarcity`, !/spots? left|hurry/i.test(t));
    const hrefs = await page.evaluate(() =>
      [...document.querySelectorAll('a')].map((a) => a.getAttribute('href')),
    );
    check(
      `funnel @${w}: claim CTA carries the listing and corridor`,
      hrefs.some((x) => x.includes('interest=listing-claim') && x.includes('lcorr=i95')),
      hrefs.join(' '),
    );
    check(
      `funnel @${w}: featured CTA carries the listing`,
      hrefs.some((x) => x.includes('interest=featured-listing')),
    );
    check(
      `funnel @${w}: CTAs meet a 44px tap target`,
      await page.evaluate(() =>
        [...document.querySelectorAll('a')].every((a) => a.getBoundingClientRect().height >= 44),
      ),
    );
    await ctx.close();
  }

  /* -------------------------------------------- deep link + keyboard order */
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.goto(
      `${BASE}/sponsors?interest=corridor-sponsor&listing=snider-fleet-solutions-florence-florence-sc` +
        '&lname=snider-fleet-solutions&lcat=tire-repair&lstate=SC&lcorr=i95&from=directory-listing#inquire',
      { waitUntil: 'networkidle' },
    );
    const text = await page.evaluate(() => document.body.innerText);
    check('deep link: context panel names the listing', text.includes('snider-fleet-solutions'));
    check('deep link: corridor carried through', /I-95/.test(text));
    check(
      'deep link: interest preselected',
      (await page.locator('#sponsor_interest').inputValue()) === 'corridor-sponsor',
    );

    await page.locator('body').press('Tab');
    const order = [];
    for (let i = 0; i < 60; i++) {
      const id = await page.evaluate(() => document.activeElement?.id || '');
      if (id) order.push(id);
      await page.keyboard.press('Tab');
    }
    for (const id of [
      'sponsor_company',
      'sponsor_contact_name',
      'sponsor_email',
      'sponsor_phone',
      'sponsor_interest',
      'sponsor_billing',
      'sponsor_message',
    ]) {
      check(`keyboard: ${id} reachable by Tab`, order.includes(id), order.join(','));
    }
    check(
      'keyboard: fields tab in visual order',
      order.indexOf('sponsor_company') < order.indexOf('sponsor_email') &&
        order.indexOf('sponsor_email') < order.indexOf('sponsor_message'),
    );
    await ctx.close();
  }

  /* ------------------------------------------------------------- injection */
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    let dialog = false;
    page.on('dialog', async (d) => {
      dialog = true;
      await d.dismiss();
    });
    await page.goto(
      `${BASE}/sponsors?interest=%22%3E%3Cscript%3Ealert(1)%3C/script%3E` +
        '&listing=%22%3E%3Cimg%20src%3Dx%20onerror%3Dalert(1)%3E&lname=%3Cscript%3E' +
        '&lcat=%3Cb%3E&lstate=ZZZZ&lcorr=javascript%3Aalert(1)',
      { waitUntil: 'networkidle' },
    );
    check('injection: no dialog fired', !dialog);
    check(
      'injection: no injected script in the DOM',
      !/<script>alert\(1\)/.test(await page.content()),
    );
    check(
      'injection: a bogus interest is not preselected',
      (await page.locator('#sponsor_interest').inputValue()) === '',
    );
    check(
      'injection: a bogus state is dropped',
      !(await page.evaluate(() => document.body.innerText)).includes('ZZZZ'),
    );
    await ctx.close();
  }

  /* ------------------------------------------------- form failure + retry */
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(`${BASE}/sponsors#inquire`, { waitUntil: 'networkidle' });
    let posted = 0;
    await page.route('**/api/sponsor-inquiry', async (route) => {
      posted++;
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, error: 'Simulated failure' }),
      });
    });

    await page.locator('button[type="submit"]').click();
    check('form: an empty submit never posts', posted === 0);
    check(
      'form: a field error is shown',
      /Enter your company name|Enter a valid email/.test(
        await page.evaluate(() => document.body.innerText),
      ),
    );

    await page.fill('#sponsor_company', 'Test Co');
    await page.fill('#sponsor_email', 'test@example.com');
    await page.locator('button[type="submit"]').click();
    check('form: no post without a verification token', posted === 0);
    check(
      'form: the verification requirement is explained',
      /verification/i.test(await page.evaluate(() => document.body.innerText)),
    );
    check('form: still usable for a retry', await page.locator('#sponsor_company').isVisible());
    await ctx.close();
  }

  /* --------------------------------------------- analytics failure is safe */
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => {
      window.plausible = () => {
        throw new Error('analytics blocked');
      };
    });
    await page.goto(`${BASE}/sponsors#inquire`, { waitUntil: 'networkidle' });
    await page.fill('#sponsor_company', 'Test Co');
    await page.selectOption('#sponsor_interest', 'featured-listing');
    await page.selectOption('#sponsor_billing', 'annual');
    check(
      'analytics-fail: the form is still interactive',
      (await page.locator('#sponsor_company').inputValue()) === 'Test Co',
    );
    check(
      'analytics-fail: the interest still selects',
      (await page.locator('#sponsor_interest').inputValue()) === 'featured-listing',
    );
    check('analytics-fail: no uncaught page error', errors.length === 0, errors[0]);
    await ctx.close();
  }

  /* ------------------------------------------- admin: authorization + a11y */
  {
    // Unauthenticated first. Every admin route must bounce to the login page.
    const anon = await browser.newContext();
    const anonPage = await anon.newPage();
    for (const path of [
      '/admin/directory/placements',
      '/admin/sponsors',
      '/admin/directory/sponsors',
      '/admin/directory',
    ]) {
      await anonPage.goto(BASE + path, { waitUntil: 'domcontentloaded' });
      check(
        `authz: ${path} redirects an anonymous visitor to login`,
        anonPage.url().includes('/admin/login'),
        anonPage.url(),
      );
    }
    // And the gate is not merely a redirect on the page — the placements
    // console must not have leaked any markup before bouncing.
    const leaked = await anonPage.evaluate(() => document.body.innerText);
    check(
      'authz: no admin content leaks to an anonymous visitor',
      !/Paid placements/i.test(leaked),
    );
    await anon.close();

    // The password check itself: a wrong one is bounced with ?error=1, the real
    // one is not. The issued cookie is Secure, which a browser will not store
    // over plain http, so the session below is seeded directly rather than by
    // logging in. That is a local-transport limitation, not an auth bypass —
    // the value is the same HMAC the app itself would issue, and a forged one
    // is asserted to fail.
    const login = await browser.newContext();
    const loginPage = await login.newPage();
    for (const [label, pw, expectError] of [
      ['a wrong password', `${ADMIN_PASSWORD}-wrong`, true],
      ['the correct password', ADMIN_PASSWORD, false],
    ]) {
      await loginPage.goto(`${BASE}/admin/login`, { waitUntil: 'networkidle' });
      await loginPage.fill('input[name="password"]', pw);
      await loginPage.locator('button[type="submit"]').click();
      // A server action navigates via the router, so the load state may already
      // be idle. Wait for the outcome itself rather than for a page load.
      const rejected = await loginPage
        .waitForFunction(
          () =>
            location.search.includes('error=1') ||
            document.body.innerText.includes('Incorrect password'),
          undefined,
          { timeout: 8000 },
        )
        .then(() => true)
        .catch(() => false);
      check(
        `authz: ${label} is ${expectError ? 'rejected' : 'accepted'}`,
        rejected === expectError,
        loginPage.url(),
      );
    }
    await login.close();

    const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    await ctx.addCookies([
      {
        name: 'tlws_admin',
        value: createHmac('sha256', ADMIN_SESSION_SECRET)
          .update('tlws-admin-session-v1')
          .digest('hex'),
        domain: '127.0.0.1',
        path: '/',
        httpOnly: true,
        sameSite: 'Lax',
      },
    ]);
    const page = await ctx.newPage();
    await page.goto(`${BASE}/admin/directory/placements`, { waitUntil: 'networkidle' });
    check(
      'authz: a valid session reaches the placements console',
      !page.url().includes('/admin/login'),
      page.url(),
    );

    const forged = await browser.newContext();
    await forged.addCookies([
      { name: 'tlws_admin', value: 'f'.repeat(64), domain: '127.0.0.1', path: '/', httpOnly: true },
    ]);
    const forgedPage = await forged.newPage();
    await forgedPage.goto(`${BASE}/admin/directory/placements`, { waitUntil: 'domcontentloaded' });
    check(
      'authz: a forged session cookie is rejected',
      forgedPage.url().includes('/admin/login'),
      forgedPage.url(),
    );
    await forged.close();

    for (const [name, path] of [
      ['placements console', '/admin/directory/placements'],
      ['sponsor inbox', '/admin/sponsors'],
    ]) {
      for (const [w, h] of [
        [390, 844],
        [1280, 900],
      ]) {
        await page.setViewportSize({ width: w, height: h });
        const res = await page.goto(BASE + path, { waitUntil: 'networkidle' });
        check(`${name} @${w}: 200`, res.status() === 200, res.status());
        const v = await axeViolations(page);
        check(
          `${name} @${w}: no serious/critical a11y violations`,
          v.length === 0,
          v.map((x) => `${x.id}(${x.nodes.length})`).join(', '),
        );
        check(`${name} @${w}: no horizontal overflow`, !(await overflows(page)));
      }
    }

    // The placements console says the things it must say. (Without a database
    // it renders its "could not read" state, so this checks the copy that is
    // always present, not the live rows.)
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto(`${BASE}/admin/directory/placements`, { waitUntil: 'networkidle' });
    const console_ = (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ');
    check(
      'placements: states the approved featured price',
      console_.includes('$99/month or $999/year'),
    );
    check(
      'placements: states the approved corridor price',
      console_.includes('$299/month or $2,999/year'),
    );
    check('placements: states the capacity', /1 primary sponsor per corridor page/i.test(console_));
    check(
      'placements: states the three-per-page limit',
      /up to 3 sponsored listings/i.test(console_),
    );
    check('placements: states that it takes no payment', /takes no payment/i.test(console_));
    check(
      'placements: states that paid placement is labelled Sponsored',
      /labelled Sponsored/i.test(console_),
    );
    check(
      'placements: admits the capacity check is not a database constraint',
      /not a database constraint/i.test(console_),
    );
    check('placements: requires a typed confirmation', /Type ACTIVATE to confirm/i.test(console_));
    check(
      'placements: sends claims elsewhere',
      /Claims are free and are handled on/i.test(console_),
    );
    // Keyboard: the corridor activation form is fully reachable by Tab.
    await page.locator('body').press('Tab');
    const ids = [];
    for (let i = 0; i < 80; i++) {
      const n = await page.evaluate(() => {
        const el = document.activeElement;
        return el && 'name' in el ? String(el.name || '') : '';
      });
      if (n) ids.push(n);
      await page.keyboard.press('Tab');
    }
    for (const n of [
      'name',
      'corridor',
      'url',
      'billing',
      'starts_on',
      'ends_on',
      'reviewer',
      'confirm',
    ]) {
      check(`placements keyboard: ${n} reachable by Tab`, ids.includes(n), ids.join(','));
    }
    await ctx.close();
  }

  /* -------------------------------------------------------- internal links */
  {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const seen = new Set();
    for (const [, url] of PAGES) {
      await page.goto(BASE + url, { waitUntil: 'domcontentloaded' });
      for (const h of await page.evaluate(() =>
        [...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute('href')),
      ))
        seen.add(h.split('#')[0]);
    }
    // Routes whose content lives in the database cannot resolve without one.
    const dbBacked = (h) => /^\/knowledge\/[^/]+/.test(h) || /^\/directory\/location\//.test(h);
    const broken = [];
    const unverifiable = [];
    for (const href of seen) {
      const r = await page.request.get(BASE + href, { maxRedirects: 5 });
      if (r.status() < 400) continue;
      (dbBacked(href) ? unverifiable : broken).push(`${href} -> ${r.status()}`);
    }
    check(
      `internal links: ${seen.size - unverifiable.length} code-resolved links all reachable`,
      broken.length === 0,
      broken.slice(0, 5).join('; '),
    );
    if (unverifiable.length)
      console.log(
        `note: ${unverifiable.length} database-backed route(s) unverifiable here: ${unverifiable.join(', ')}`,
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

console.log(`\ndirectory-revenue e2e: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
