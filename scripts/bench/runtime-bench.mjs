/**
 * Runtime benchmark: what a running server actually spends per page class.
 *
 * `next start` serves the tree's production build against the local mock
 * PostgREST. The sweep hits three page classes with different runtime
 * characters:
 *
 *   - parking/[state] and cat-scales/[state] have NO generateStaticParams —
 *     the first request is a full cold server render (blocking TTFB).
 *   - exit pages were prerendered at build; past their revalidate window
 *     they serve stale and regenerate in the BACKGROUND, so their runtime
 *     cost shows up in the mock request log, not in TTFB.
 *   - new-locations?page=N reads searchParams and is fully dynamic.
 *
 * Per page we record TTFB and, from the mock's request log, how many
 * database round trips the sweep triggered. Compare across trees to see
 * what a data-layer change costs (or saves) at runtime rather than at build.
 *
 * Usage:
 *   node scripts/bench/runtime-bench.mjs --tree /path/to/built-checkout \
 *     --label before [--latency 25] [--port 54999] [--appPort 3123] [--out out.json]
 *
 * The tree must already contain a production .next build made against the
 * same mock URL (build-bench.mjs leaves one behind).
 */
import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? fallback : process.argv[i + 1];
}

const TREE = arg('tree');
const LABEL = arg('label', 'run');
const LATENCY = Number(arg('latency', '25'));
const PORT = Number(arg('port', '54999'));
const APP_PORT = Number(arg('appPort', '3123'));
const OUT = arg('out', path.join(process.cwd(), `runtime-${LABEL}.json`));
if (!TREE || !fs.existsSync(path.join(TREE, '.next'))) {
  console.error('--tree must point at a checkout with a production .next build');
  process.exit(2);
}

const LOG = OUT.replace(/\.json$/, '') + '.requests.jsonl';
fs.rmSync(LOG, { force: true });

const benchDir = path.dirname(new URL(import.meta.url).pathname);
const mock = spawn('node', [path.join(benchDir, 'mock-postgrest.mjs')], {
  env: { ...process.env, MOCK_PORT: String(PORT), MOCK_LOG: LOG, MOCK_LATENCY_MS: String(LATENCY) },
  stdio: ['ignore', 'inherit', 'inherit'],
});

const app = spawn('npx', ['next', 'start', '-p', String(APP_PORT)], {
  cwd: TREE,
  env: {
    ...process.env,
    NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${PORT}`,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-anon-key',
    NEXT_PUBLIC_SITE_URL: 'https://truckinglifewithshawn.com',
    NEXT_TELEMETRY_DISABLED: '1',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});
app.stdout.on('data', () => {});
app.stderr.on('data', () => {});

async function waitFor(url, tries = 100) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.status < 500) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  throw new Error(`not reachable: ${url}`);
}

const mockRequests = async () =>
  (await (await fetch(`http://127.0.0.1:${PORT}/__mock/health`)).json()).requests;

// Cold state pages (no generateStaticParams), background-regen exit pages,
// one dynamic route, one prerendered detail-class page as control.
const PATHS = [
  '/directory/parking/GA',
  '/directory/parking/TX',
  '/directory/parking/OH',
  '/directory/cat-scales/AL',
  '/directory/cat-scales/CA',
  '/directory/i75/exit-101',
  '/directory/i40/exit-55',
  '/directory/truck-stops',
  '/directory/new-locations?page=2',
  '/directory',
];

try {
  await waitFor(`http://127.0.0.1:${PORT}/__mock/health`);
  await waitFor(`http://127.0.0.1:${APP_PORT}/directory`);
  // Let any regen triggered by the readiness probe settle before measuring.
  await new Promise((r) => setTimeout(r, 3000));

  const results = [];
  for (const p of PATHS) {
    const reqBefore = await mockRequests();
    const t0 = process.hrtime.bigint();
    const res = await fetch(`http://127.0.0.1:${APP_PORT}${p}`);
    await res.arrayBuffer();
    const ttfbMs = Number((process.hrtime.bigint() - t0) / 1_000_000n);
    // Background ISR regeneration keeps issuing reads after the response —
    // give it a beat so the page's true DB cost lands in the window.
    await new Promise((r) => setTimeout(r, 2500));
    const dbRequests = (await mockRequests()) - reqBefore;
    results.push({ path: p, status: res.status, ttfbMs, dbRequests });
    console.log(
      `[runtime ${LABEL}] ${p} -> ${res.status} in ${ttfbMs}ms, ${dbRequests} DB requests`,
    );
  }

  fs.writeFileSync(OUT, JSON.stringify({ label: LABEL, tree: TREE, results }, null, 2));
  console.log(`[runtime] results -> ${OUT}`);
} finally {
  app.kill();
  mock.kill();
}
