/**
 * Build benchmark orchestrator.
 *
 * Runs `next build` for a given tree against the local mock PostgREST server
 * and reports what the build actually did to the database layer: wall time,
 * total requests, requests per table, and the distinct query shapes issued
 * against `locations` with their repeat counts. This turns "the build reads
 * too much" from an estimate into a measurement.
 *
 * Usage:
 *   node scripts/bench/build-bench.mjs --tree /path/to/checkout --label before \
 *     [--latency 25] [--port 54999] [--out /path/results.json]
 *
 * The tree must have node_modules available (a symlink to a shared install is
 * fine). The mock is started and stopped by this script; its request log is
 * written next to --out. Latency defaults to 25ms per request — the order of
 * a same-region TCP+TLS PostgREST round trip — so request amplification shows
 * up in wall time the way it would in a real build.
 */
import { spawn, execFileSync } from 'node:child_process';
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
const OUT = arg('out', path.join(process.cwd(), `bench-${LABEL}.json`));
if (!TREE || !fs.existsSync(path.join(TREE, 'package.json'))) {
  console.error('--tree must point at a checkout with package.json');
  process.exit(2);
}

const LOG = OUT.replace(/\.json$/, '') + '.requests.jsonl';
fs.rmSync(LOG, { force: true });

const mockDir = path.dirname(new URL(import.meta.url).pathname);
const mock = spawn('node', [path.join(mockDir, 'mock-postgrest.mjs')], {
  env: { ...process.env, MOCK_PORT: String(PORT), MOCK_LOG: LOG, MOCK_LATENCY_MS: String(LATENCY) },
  stdio: ['ignore', 'inherit', 'inherit'],
});

const health = `http://127.0.0.1:${PORT}/__mock/health`;
async function waitForMock() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(health);
      if (res.ok) return;
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error('mock-postgrest did not come up');
}

try {
  await waitForMock();

  // Gate on the mock's own contract before trusting any numbers.
  execFileSync('node', [path.join(mockDir, 'test-mock-postgrest.mjs')], {
    env: { ...process.env, MOCK_PORT: String(PORT) },
    stdio: 'inherit',
  });

  console.log(`\n[bench] building ${TREE} as "${LABEL}" (latency ${LATENCY}ms)...`);
  fs.rmSync(path.join(TREE, '.next'), { recursive: true, force: true });
  const t0 = Date.now();
  execFileSync('npx', ['next', 'build'], {
    cwd: TREE,
    env: {
      ...process.env,
      NEXT_PUBLIC_SUPABASE_URL: `http://127.0.0.1:${PORT}`,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'placeholder-anon-key',
      NEXT_PUBLIC_SITE_URL: 'https://truckinglifewithshawn.com',
      NEXT_TELEMETRY_DISABLED: '1',
    },
    stdio: 'inherit',
  });
  const wallMs = Date.now() - t0;

  // ---- analyze the request log ------------------------------------------
  const lines = fs.existsSync(LOG)
    ? fs.readFileSync(LOG, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))
    : [];

  const byTable = {};
  for (const r of lines) byTable[r.table] = (byTable[r.table] ?? 0) + 1;

  // Normalize a locations query to its SHAPE: drop cursor values so every
  // page of one keyset scan folds into a single shape, and sort params so
  // ordering differences do not split shapes.
  const shapeOf = (q) => {
    const p = new URLSearchParams(q.startsWith('?') ? q.slice(1) : q);
    const parts = [];
    for (const [k, v] of p.entries()) {
      parts.push(k === 'id' && v.startsWith('gt.') ? 'id=gt.<cursor>' : `${k}=${v}`);
    }
    return parts.sort().join('&');
  };
  const shapes = {};
  for (const r of lines) {
    if (r.table !== 'locations') continue;
    const s = `${r.method} ${shapeOf(r.query)}${/count=/.test(r.prefer ?? '') ? ' [count]' : ''}`;
    shapes[s] = (shapes[s] ?? 0) + 1;
  }

  const result = {
    label: LABEL,
    tree: TREE,
    latencyMs: LATENCY,
    wallMs,
    totalRequests: lines.length,
    byTable,
    locationsShapes: Object.fromEntries(Object.entries(shapes).sort((a, b) => b[1] - a[1])),
  };
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2));

  console.log(`\n[bench] ${LABEL}: build ${(wallMs / 1000).toFixed(1)}s, ` +
    `${lines.length} DB requests (${byTable.locations ?? 0} to locations)`);
  console.log(`[bench] results -> ${OUT}`);
} finally {
  mock.kill();
}
