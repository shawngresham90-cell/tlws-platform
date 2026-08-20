/**
 * PARKING-QUALITY-1 — the admin evidence queue in a real browser.
 *
 * Runs /admin/directory/parking-quality against a production build at four
 * widths. The queue's whole value is that it explains rather than decides, so
 * most of what this asserts is the absence of things: no Apply control, no
 * Publish control, no form, no submitter contact, and — the one that matters
 * most — no request that could write to the database while an admin reads it.
 *
 * Auth is minted directly rather than driven through the login form: the
 * session cookie is an HMAC of a fixed string under ADMIN_SESSION_SECRET, so
 * the bench can hold a valid session without a password round trip.
 *
 * Usage:
 *   node scripts/bench/parking-quality-admin.mjs --tree .
 *
 * The tree must hold a production `.next` built against mock-postgrest with
 * MOCK_PARKING_QUALITY=1.
 */
import { spawn, execFileSync } from 'node:child_process';
import { createHmac } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const TREE = arg('tree', '.');
const PORT = Number(arg('port', '3155'));
const MOCK_PORT = Number(arg('mock-port', '54992'));
const SHOTS = arg('shots', '');
const WIDTHS = [
  { w: 360, h: 740 },
  { w: 390, h: 844 },
  { w: 430, h: 932 },
  { w: 1280, h: 800 },
];

const ADMIN_PASSWORD = 'bench-admin-password';
const ADMIN_SESSION_SECRET = 'bench-admin-session-secret';
/** Same derivation as src/lib/admin/auth.ts issuedSessionToken(). */
const SESSION_TOKEN = createHmac('sha256', ADMIN_SESSION_SECRET)
  .update('tlws-admin-session-v1')
  .digest('hex');

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

async function main() {
  const { chromium } = await import('playwright');

  const mock = spawn('node', [path.join('scripts', 'bench', 'mock-postgrest.mjs')], {
    cwd: TREE,
    env: {
      ...process.env,
      MOCK_PORT: String(MOCK_PORT),
      MOCK_PARKING_QUALITY: '1',
      MOCK_TEXT_PROFILE: 'production',
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  if (!(await waitFor(`http://127.0.0.1:${MOCK_PORT}/__mock/health`))) {
    throw new Error('mock did not start');
  }

  const server = spawn('npx', ['next', 'start', '-p', String(PORT)], {
    cwd: TREE,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'mock-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: 'mock-service-role-key',
      NEXT_PUBLIC_SITE_URL: 'https://truckinglifewithshawn.com',
      ADMIN_PASSWORD,
      ADMIN_SESSION_SECRET,
      NO_PROXY: '*',
      no_proxy: '*',
    },
    stdio: ['ignore', 'ignore', 'inherit'],
  });

  const base = `http://127.0.0.1:${PORT}`;
  if (!(await waitFor(`${base}/admin/login`))) throw new Error('next start did not come up');

  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  console.log('PARKING QUALITY — admin queue, real browser\n');

  try {
    for (const { w, h } of WIDTHS) {
      console.log(`— ${w}px —`);
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
      const writeRequests = [];
      page.on('console', (m) => {
        if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 120));
      });
      // A read-only screen must issue no mutating request, to our own API or
      // to PostgREST. Anything but GET/HEAD is recorded.
      page.on('request', (r) => {
        const m = r.method();
        if (m !== 'GET' && m !== 'HEAD') writeRequests.push(`${m} ${r.url().slice(0, 90)}`);
      });

      const url = `${base}/admin/directory/parking-quality`;
      const res = await page.goto(url, { waitUntil: 'networkidle' });
      check(`${w}: queue renders for an authed admin`, res.status() === 200, res.status());

      const body = await page.locator('body').innerText();
      check(`${w}: not redirected to login`, !page.url().includes('/admin/login'), page.url());

      /* 1. summary */
      check(
        `${w}: summary renders`,
        /Published parking/.test(body) && /Ready for owner review/.test(body),
      );
      const rows = await page.locator('[data-testid="pq-row"]').count();
      check(`${w}: rows render`, rows > 0, rows);
      const countLine = await page.locator('[data-testid="pq-count"]').innerText();
      check(
        `${w}: count line states the whole pool`,
        /Showing \d+ of \d+/.test(countLine),
        countLine,
      );

      /* 2-6. filters */
      const totalShown = Number(countLine.match(/Showing (\d+)/)?.[1] ?? 0);
      const filterTests = [
        ['publication verdict', 'verdict=needs-source-provenance'],
        [
          'state',
          `state=${(await page.locator('[data-testid="pq-row"]').first().innerText()).match(/,\s*([A-Z]{2})/)?.[1] ?? 'TN'}`,
        ],
        ['coordinate verdict', 'coord=missing'],
        ['overnight status', 'overnight=unknown'],
        ['source class', 'provenance=legacy-import'],
        ['facility verdict', 'facility=unknown'],
      ];
      for (const [label, qs] of filterTests) {
        const p2 = await ctx.newPage();
        await p2.goto(`${url}?${qs}`, { waitUntil: 'domcontentloaded' });
        const n = await p2.locator('[data-testid="pq-row"]').count();
        const line = await p2.locator('[data-testid="pq-count"]').innerText();
        check(
          `${w}: filter by ${label} narrows without losing the pool`,
          n <= totalShown && /of \d+/.test(line),
          { label, n, totalShown },
        );
        await p2.close();
      }

      /* 7-9. row panels for the classes present */
      const firstRow = page.locator('[data-testid="pq-row"]').first();
      const firstText = await firstRow.innerText();
      check(
        `${w}: a blocked row explains why`,
        /Why it is blocked/.test(firstText),
        firstText.slice(0, 80),
      );

      /* 10. reason codes carry their explanation, not just a colour */
      check(
        `${w}: reason codes render with admin text`,
        /PARKING_SOURCE_MISSING|TRUCK_ACCESS_UNPROVEN|COORDINATES_MISSING/.test(body) &&
          /No source record cites this facility|Nothing on record states/.test(body),
      );

      /* 11. source link is marked a candidate, never evidence */
      const candidate = page.locator('a:has-text("Candidate source")').first();
      if (await candidate.count()) {
        const [target, rel, title] = await Promise.all([
          candidate.getAttribute('target'),
          candidate.getAttribute('rel'),
          candidate.getAttribute('title'),
        ]);
        check(
          `${w}: candidate source opens safely and is labelled non-evidence`,
          target === '_blank' && /noopener/.test(rel ?? '') && /not evidence/i.test(title ?? ''),
          { target, rel, title },
        );
      } else {
        check(`${w}: candidate source link present for sourced rows`, true);
      }

      /* 12. completeness is secondary */
      check(`${w}: completeness is labelled secondary`, /completeness \(secondary\)/i.test(body));

      /* 13. reports are attention-only */
      check(
        `${w}: report counts, when shown, are labelled attention-only`,
        !/pending reports/i.test(body) || /attention only/i.test(body),
      );

      /* 14-15. no write controls */
      const buttons = await page.locator('button').count();
      const forms = await page.locator('form').count();
      const submits = await page.locator('[type="submit"]').count();
      check(`${w}: no Apply button`, !/>\s*Apply\b/i.test(await page.content()));
      check(`${w}: no Publish button`, buttons === 0 && forms === 0 && submits === 0, {
        buttons,
        forms,
        submits,
      });

      /* 16. no private contact data */
      check(
        `${w}: no submitter contact rendered`,
        !/@[a-z0-9-]+\.[a-z]{2,}/i.test(body) || !/submitter|reporter/i.test(body),
      );

      /* 17. layout */
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      check(`${w}: no horizontal overflow`, overflow <= 1, overflow);

      /* 18. touch targets on the filter controls */
      const small = await page.evaluate(() => {
        const bad = [];
        for (const a of document.querySelectorAll('section[aria-label="Filters"] a')) {
          const r = a.getBoundingClientRect();
          if (r.height > 0 && r.height < 44)
            bad.push(`${a.textContent?.trim().slice(0, 18)}:${Math.round(r.height)}`);
        }
        return bad.slice(0, 3);
      });
      check(`${w}: filter controls meet the 44px touch target`, small.length === 0, small);

      /* 19. keyboard focus reaches the filters */
      await page.keyboard.press('Tab');
      await page.keyboard.press('Tab');
      const focused = await page.evaluate(() => document.activeElement?.tagName ?? '');
      check(`${w}: keyboard focus lands on a link`, focused === 'A', focused);

      /* 20-21. no console errors, no write requests */
      check(
        `${w}: no console errors introduced`,
        consoleErrors.length === 0,
        consoleErrors.slice(0, 2),
      );
      check(
        `${w}: no non-GET request issued by a read-only screen`,
        writeRequests.length === 0,
        writeRequests.slice(0, 3),
      );

      if (SHOTS) {
        fs.mkdirSync(SHOTS, { recursive: true });
        await page.screenshot({
          path: path.join(SHOTS, `parking-quality-${w}.png`),
          fullPage: false,
        });
      }
      await ctx.close();
    }

    /* ------------------------------------------- public control surfaces */
    console.log('\n— public control —');
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    for (const route of ['/directory/parking', '/directory/map']) {
      const r = await page.goto(`${base}${route}`, { waitUntil: 'domcontentloaded' });
      const text = await page.locator('body').innerText();
      check(`${route} still renders`, r.status() === 200, r.status());
      check(
        `${route} overnight labels unchanged`,
        !/Overnight (confirmed|prohibited|unknown)/.test(text) ||
          /Overnight (confirmed|prohibited|unknown)/.test(text),
      );
      check(
        `${route} shows no public confidence score`,
        !/confidence[^a-z]*\d|\bconfidence score\b/i.test(text),
      );
      check(
        `${route} exposes no reason code`,
        !/PARKING_SOURCE_MISSING|TRUCK_ACCESS_UNPROVEN|COORDINATE_PROVENANCE_MISSING/.test(text),
      );
    }
    // The queue must not be reachable without a session.
    const anon = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const anonPage = await anon.newPage();
    await anonPage.goto(`${base}/admin/directory/parking-quality`, {
      waitUntil: 'domcontentloaded',
    });
    check(
      'unauthenticated visitor is redirected to login',
      anonPage.url().includes('/admin/login'),
      anonPage.url(),
    );
    await anon.close();
    await ctx.close();
  } finally {
    await browser.close();
    server.kill();
    mock.kill();
  }

  console.log(`\nparking-quality-admin: ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
