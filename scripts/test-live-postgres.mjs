/**
 * The live-database half of the Navigator account work.
 *
 * `npm test` stays hermetic — no network, no database, CI-safe. Everything it
 * can prove about migrations 049–052 it proves by reading them. Three things
 * it cannot prove that way, and they are the three that matter most about a
 * spend guard:
 *
 *   1. that the SQL executes at all on a real server,
 *   2. that two callers racing the last unit cannot both have it,
 *   3. that RLS actually refuses a cross-user read, rather than merely being
 *      written as though it would.
 *
 * `scripts/test-navigator-usage-guard.ts` says so in its own header: its
 * concurrency section is a MODEL of the SQL plus a structural check that the
 * shipped SQL is the atomic form. This file is where that stops being a model.
 *
 * ---------------------------------------------------------------------------
 * IT SKIPS CLEANLY, AND THAT IS THE POINT
 *
 * No connection URL, no `psql`, or a server that will not answer: it prints
 * why and exits 0. A test that fails when the optional environment is absent
 * teaches everyone to ignore it, and an ignored red build hides the next real
 * failure. Absent evidence is reported as absent, never as passing — the
 * summary says SKIPPED, not OK.
 *
 * ---------------------------------------------------------------------------
 * IT REFUSES TO TOUCH ANYTHING THAT LOOKS LIVE
 *
 * This script DROPS AND RECREATES the tables the migrations own. Two rails
 * stand in front of that, and both must pass:
 *
 *   - the connection must not name a known production project ref;
 *   - the target must carry no production evidence — a populated
 *     `sms_consents` (live, with real rows) or `leads` stops the run.
 *
 * Neither is clever. That is deliberate: a rail whose reasoning is subtle is
 * one a future reader will edit around.
 *
 * ---------------------------------------------------------------------------
 * Usage:
 *
 *   NAVIGATOR_TEST_DATABASE_URL='postgresql://…' npm run test:db
 *
 * The URL must point at a DISPOSABLE database. For a Supabase test project it
 * is the project's direct connection string (Settings → Database → Connection
 * string → URI), NOT the pooler, because the run creates roles and functions.
 */

import { spawn, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const URL_VARS = ['NAVIGATOR_TEST_DATABASE_URL', 'SUPABASE_TEST_DB_URL'];

/**
 * Project refs that must never be reachable from this script. The production
 * project for this repository is first; the rest are other products in the
 * same Supabase organization, which are equally not scratch space.
 */
const FORBIDDEN_REFS = [
  'cgvxwvymkembftznhcdl', // tlws-platform — PRODUCTION
  'jgzcwkorjxhbqzdzxwzt', // TruckLifePWA
  'kasbuwnrfoepodjzfiwc', // cdl-preschool
  'mmnvcbejjdweetnxncfi', // ShopScheduler
  'bvmeplpthztjqreqpwcf', // RosedaleIdle
  'avsxobudpojweuikaala', // crewcut-os
  'omylhjhvdxbjsaxfqthm', // TRUCKING-LIFE-PWA-HUFFYONLY
];

const MIGRATIONS = [
  'supabase/migrations/049_email_consents.sql',
  'supabase/migrations/050_navigator_accounts.sql',
  'supabase/migrations/051_navigator_provider_usage.sql',
  // 052 repairs the table privileges 050 meant to withhold. It is applied here
  // as well as edited into 050 for the same reason it exists in the tree: the
  // fix has to work on a project that already ran the older 050, and applying
  // both in order is the only run that proves it does.
  'supabase/migrations/052_navigator_account_table_privileges.sql',
];

let passed = 0;
let failed = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) {
    passed += 1;
  } else {
    failed += 1;
    failures.push(name);
    console.log(`FAIL: ${name}${detail === undefined ? '' : ` — ${String(detail).slice(0, 300)}`}`);
  }
}
function skip(reason) {
  console.log(`\nSKIPPED: navigator live-postgres — ${reason}`);
  console.log('This is not a pass. The live-database evidence was not collected.');
  console.log(`Set ${URL_VARS[0]} to a DISPOSABLE database to run it.`);
  process.exit(0);
}

/* ------------------------------------------------------------ preflight */

const url = URL_VARS.map((v) => process.env[v]).find((v) => v && v.trim().length > 0);
if (!url) skip(`neither ${URL_VARS.join(' nor ')} is set`);

const which = spawnSync('psql', ['--version'], { encoding: 'utf8' });
if (which.status !== 0) skip('psql is not installed or not on PATH');

for (const m of MIGRATIONS) {
  if (!existsSync(m)) skip(`migration file missing: ${m}`);
}

/** Run SQL, returning stdout. Throws with the server's message on error. */
function sql(text, { role, claims, tuplesOnly = true } = {}) {
  const preamble = [];
  if (claims !== undefined) {
    preamble.push(`select set_config('request.jwt.claims', ${quote(claims)}, false);`);
  }
  if (role !== undefined) preamble.push(`set role ${role};`);
  const script = `\\set ON_ERROR_STOP on\n${preamble.join('\n')}\n${text}`;
  const args = ['-v', 'ON_ERROR_STOP=1', '-X', tuplesOnly ? '-tA' : '-A', '-d', url, '-f', '-'];
  const res = spawnSync('psql', args, { input: script, encoding: 'utf8' });
  if (res.status !== 0) {
    const err = new Error((res.stderr || res.stdout || 'psql failed').trim());
    err.stderr = res.stderr;
    throw err;
  }
  return res.stdout.trim();
}
function quote(s) {
  return `'${String(s).replace(/'/g, "''")}'`;
}
function scalar(text, opts) {
  const out = sql(text, opts);
  return out.split('\n').filter(Boolean).pop() ?? '';
}
function runFile(path) {
  const res = spawnSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-q', '-d', url, '-f', path], {
    encoding: 'utf8',
  });
  if (res.status !== 0) throw new Error((res.stderr || res.stdout || '').trim());
  return res.stdout;
}

/* ---- safety rail 1: BEFORE ANY CONNECTION ------------------------------
 *
 * The ref check runs ahead of the reachability probe, and the order is the
 * whole point. Probing first would mean opening a session against production
 * to ask its version before deciding we were not allowed to talk to it — and
 * "we only ran a SELECT" is not a defence, it is a connection to a live
 * database this script has no business touching.
 *
 * The first draft of this file had it the other way round, and the symptom
 * was quiet: pointed at production with no network, it reported a clean SKIP
 * for the wrong reason and the refusal never fired at all.
 */
const lowerUrl = url.toLowerCase();
for (const ref of FORBIDDEN_REFS) {
  if (lowerUrl.includes(ref)) {
    console.error(
      `\nREFUSED: the connection URL names project ref ${ref}, which is not a disposable\n` +
        'test database. This script drops and recreates tables.\n' +
        'No connection was opened and nothing was run.',
    );
    process.exit(1);
  }
}

/* ---- reachable? -------------------------------------------------------- */
let serverVersion;
try {
  serverVersion = scalar('select version();');
} catch (e) {
  skip(`the database did not answer (${String(e.message).split('\n')[0]})`);
}

function tableRowCount(name) {
  try {
    return Number(scalar(`select count(*) from public.${name};`));
  } catch {
    return 0; // absent table = no evidence of production
  }
}
for (const t of ['sms_consents', 'leads', 'navigator_profiles']) {
  const n = tableRowCount(t);
  if (n > 0) {
    console.error(
      `\nREFUSED: public.${t} on the target holds ${n} row(s). That is production-shaped\n` +
        'evidence, not scratch data. This script drops and recreates tables. Nothing was run.',
    );
    process.exit(1);
  }
}

console.log(`\nnavigator live-postgres`);
console.log(`  server : ${serverVersion.split(',')[0]}`);

/* ---- Supabase shape ---------------------------------------------------- */
const hasAuthUsers = scalar("select to_regclass('auth.users') is not null;") === 't';
if (!hasAuthUsers) {
  console.log('  target : plain PostgreSQL — applying scripts/sql/supabase-shim.sql');
  runFile('scripts/sql/supabase-shim.sql');
} else {
  console.log('  target : Supabase-shaped (auth.users present) — shim NOT applied');
}

/* ===================================================================== *
 * 1. THE MIGRATIONS EXECUTE
 * ===================================================================== */
for (const m of MIGRATIONS) {
  const label = m.split('/').pop();
  try {
    runFile(m);
    check(`1: ${label} executes on real PostgreSQL`, true);
  } catch (e) {
    check(`1: ${label} executes on real PostgreSQL`, false, e.message);
  }
}
/* Idempotency is a claim each migration makes in its own header. Applying
 * twice is the only way to find out. */
for (const m of MIGRATIONS) {
  const label = m.split('/').pop();
  try {
    runFile(m);
    check(`1b: ${label} is idempotent — a second apply is a no-op`, true);
  } catch (e) {
    check(`1b: ${label} is idempotent — a second apply is a no-op`, false, e.message);
  }
}

/* ---- fixtures ---------------------------------------------------------- */
const UID_A = '11111111-1111-4111-8111-111111111111';
const UID_B = '22222222-2222-4222-8222-222222222222';
sql(`
  insert into auth.users (id, email) values
    ('${UID_A}', 'live-test-a@example.invalid'),
    ('${UID_B}', 'live-test-b@example.invalid')
  on conflict (id) do nothing;
`);

const RESERVE = 'public.navigator_reserve_provider_units';
function reserve(uid, endpoint, units, month, threshold, userLimit) {
  /*
   * `allowed` is rendered explicitly rather than concatenated raw: in
   * PostgreSQL `boolean || text` casts the boolean to 'true'/'false', while
   * the same column printed by psql's tuples-only mode is 't'/'f'. Comparing
   * against the wrong one of those makes every reservation read as refused —
   * quietly, and in a way that still produces a plausible-looking number.
   */
  const out = scalar(
    `select (case when allowed then 'Y' else 'N' end) || '|' || reason || '|' || global_units || '|' || user_units
       from ${RESERVE}('${uid}'::uuid, ${quote(endpoint)}, ${units}, ${quote(month)}, ${threshold}, ${userLimit});`,
  );
  const [allowed, reason, globalUnits, userUnits] = out.split('|');
  return {
    allowed: allowed === 'Y',
    reason,
    globalUnits: Number(globalUnits),
    userUnits: Number(userUnits),
  };
}

/**
 * Run N psql workers GENUINELY IN PARALLEL, each performing `iters`
 * reservations, all released at a common wall-clock instant.
 *
 * Two things here are load-bearing and both were wrong in the first draft:
 *
 *   `spawn`, NOT `spawnSync`. spawnSync blocks until each child exits, so the
 *   workers ran one after another and the `pg_sleep_until` barrier only
 *   delayed the first — a test named "concurrency" that contained none.
 *
 *   A PL/pgSQL LOOP, not `generate_series(…) , lateral f(…)`. The function's
 *   arguments do not reference the series, so the planner is free to evaluate
 *   it ONCE and join the single result row to every generated row. That is
 *   exactly what happened: 24 workers reported 25 acceptances each — 600 —
 *   while the ledger had recorded 24 increments in total. The count was
 *   measuring row duplication, not work done. An explicit loop forces one
 *   call per iteration.
 *
 * Each worker records its own accepted count in a scratch table, so the
 * worker's view and the ledger's view can be compared against each other
 * rather than one being assumed from the other.
 */
function runWorkers({ workers, iters, uidFor, endpoint, units, month, threshold, userLimit }) {
  sql(`
    drop table if exists public._navtest_results;
    create table public._navtest_results (worker int, accepted int, attempted int);
  `);
  const startAt = new Date(Date.now() + Math.max(2000, workers * 60)).toISOString();

  const body = (worker, uid) => `
\\set ON_ERROR_STOP on
select pg_sleep_until('${startAt}'::timestamptz);
do $$
declare
  v_allowed boolean;
  v_accepted int := 0;
  v_attempted int := 0;
begin
  for i in 1..${iters} loop
    select r.allowed into v_allowed
      from ${RESERVE}('${uid}'::uuid, ${quote(endpoint)}, ${units}, ${quote(month)}, ${threshold}, ${userLimit}) r;
    v_attempted := v_attempted + 1;
    if v_allowed then v_accepted := v_accepted + 1; end if;
  end loop;
  insert into public._navtest_results (worker, accepted, attempted)
    values (${worker}, v_accepted, v_attempted);
end
$$;
`;

  return Promise.all(
    Array.from({ length: workers }, (_, i) => {
      return new Promise((resolve) => {
        const child = spawn('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-tA', '-d', url, '-f', '-'], {
          stdio: ['pipe', 'pipe', 'pipe'],
        });
        let stderr = '';
        child.stderr.on('data', (d) => (stderr += d));
        child.on('close', (code) => resolve({ code, stderr }));
        child.stdin.end(body(i, uidFor(i)));
      });
    }),
  );
}

function workerTotals() {
  const accepted = Number(scalar('select coalesce(sum(accepted),0) from public._navtest_results;'));
  const attempted = Number(
    scalar('select coalesce(sum(attempted),0) from public._navtest_results;'),
  );
  const reported = Number(scalar('select count(*) from public._navtest_results;'));
  return { accepted, attempted, reported };
}
function resetLedger() {
  sql(`truncate public.navigator_provider_month, public.navigator_provider_usage,
              public.navigator_provider_user_usage;`);
}

/* ===================================================================== *
 * 2. GENUINE CONCURRENCY — the global threshold cannot be overshot
 * ===================================================================== */
async function section2() {
  resetLedger();
  const THRESHOLD = 100;
  const WORKERS = 24;
  const ITERS = 25; // 600 attempts against a ceiling of 100

  const results = await runWorkers({
    workers: WORKERS,
    iters: ITERS,
    uidFor: (i) => (i % 2 === 0 ? UID_A : UID_B),
    endpoint: 'navigator.route',
    units: 1,
    month: '2026-08',
    threshold: THRESHOLD,
    userLimit: 100000,
  });

  const errors = results.filter((r) => r.code !== 0).map((r) => r.stderr.trim());
  check('2a: every concurrent worker completed without error', errors.length === 0, errors[0]);

  const t = workerTotals();
  const monthUnits = Number(
    scalar(
      "select coalesce(units,0) from public.navigator_provider_month where month = '2026-08';",
    ),
  );
  const ledgerUnits = Number(
    scalar(
      "select coalesce(sum(units),0) from public.navigator_provider_usage where month = '2026-08';",
    ),
  );
  const userUnits = Number(
    scalar(
      "select coalesce(sum(units),0) from public.navigator_provider_user_usage where month = '2026-08';",
    ),
  );

  check('2b: all workers reported in', t.reported === WORKERS, `${t.reported}/${WORKERS}`);
  check(
    `2c: ${WORKERS} workers × ${ITERS} attempts really were attempted`,
    t.attempted === WORKERS * ITERS,
    t.attempted,
  );
  check(
    '2d: accepted stops EXACTLY at the threshold — never one unit over',
    t.accepted === THRESHOLD,
    `accepted=${t.accepted} threshold=${THRESHOLD}`,
  );
  check(
    '2e: the shared month row agrees with what the workers were told',
    monthUnits === THRESHOLD,
    monthUnits,
  );
  check('2f: the per-endpoint ledger agrees', ledgerUnits === THRESHOLD, ledgerUnits);
  check('2g: the per-user ledger agrees', userUnits === THRESHOLD, userUnits);
  console.log(
    `  race   : ${WORKERS} parallel psql backends, ${t.attempted} attempts, ` +
      `${t.accepted} accepted, threshold ${THRESHOLD}, month row ${monthUnits}`,
  );
  check(
    '2h: far more was attempted than allowed, so the race was real and contested',
    t.attempted > THRESHOLD * 2 && t.accepted < t.attempted,
    `${t.accepted}/${t.attempted}`,
  );
}

/* ===================================================================== *
 * 3. PER-USER LIMIT UNDER CONCURRENCY
 * ===================================================================== */
async function section3() {
  resetLedger();
  const USER_LIMIT = 15;
  const WORKERS = 16;
  const ITERS = 10; // 160 attempts against one driver's ceiling of 15

  const results = await runWorkers({
    workers: WORKERS,
    iters: ITERS,
    uidFor: () => UID_A,
    endpoint: 'navigator.destination-search',
    units: 1,
    month: '2026-08',
    threshold: 1000000,
    userLimit: USER_LIMIT,
  });
  const errors = results.filter((r) => r.code !== 0).map((r) => r.stderr.trim());
  check('3a: every worker completed', errors.length === 0, errors[0]);

  const t = workerTotals();
  check(
    `3b: one driver's limit holds exactly under ${WORKERS} concurrent workers`,
    t.accepted === USER_LIMIT,
    `accepted=${t.accepted} limit=${USER_LIMIT}`,
  );
  const stored = Number(
    scalar(
      `select units from public.navigator_provider_user_usage where month='2026-08' and user_id='${UID_A}';`,
    ),
  );
  console.log(
    `  peruser: ${WORKERS} parallel backends, ${t.attempted} attempts, ` +
      `${t.accepted} accepted, per-user limit ${USER_LIMIT}`,
  );
  check('3c: and the stored per-user total matches', stored === USER_LIMIT, stored);

  const other = reserve(UID_B, 'navigator.route', 1, '2026-08', 1000000, USER_LIMIT);
  check(
    '3d: another driver is not blocked by the first hitting their limit',
    other.allowed,
    other.reason,
  );
}

async function section4to11() {
  /* ===================================================================== *
   * 4. THE REFUSED-GLOBAL UNDO
   * ===================================================================== *
   * When the per-user increment succeeds and the global test then fails, the
   * per-user increment must be undone — otherwise a driver is charged for a
   * request that was refused.
   */
  {
    resetLedger();
    const before = reserve(UID_A, 'navigator.route', 5, '2026-08', 5, 1000);
    check('4a: a reservation up to the threshold is allowed', before.allowed, before.reason);
    const refused = reserve(UID_A, 'navigator.route', 5, '2026-08', 5, 1000);
    check('4b: the next one is refused', !refused.allowed);
    check(
      '4c: …naming the global threshold as the cause',
      refused.reason === 'global-threshold',
      refused.reason,
    );
    const userUnits = Number(
      scalar(
        `select units from public.navigator_provider_user_usage where month='2026-08' and user_id='${UID_A}';`,
      ),
    );
    const userReqs = Number(
      scalar(
        `select requests from public.navigator_provider_user_usage where month='2026-08' and user_id='${UID_A}';`,
      ),
    );
    check('4d: the refused request left the per-user units untouched', userUnits === 5, userUnits);
    check('4e: …and the per-user request count untouched', userReqs === 1, userReqs);
  }

  /* ===================================================================== *
   * 5. ENDPOINT WEIGHTS
   * ===================================================================== */
  {
    resetLedger();
    const r = reserve(UID_A, 'navigator.route', 7, '2026-08', 1000, 1000);
    check('5a: a weighted reservation is allowed', r.allowed);
    check('5b: it consumes its full weight, not one unit', r.globalUnits === 7, r.globalUnits);
    const reqs = Number(
      scalar(
        "select requests from public.navigator_provider_usage where month='2026-08' and endpoint='navigator.route';",
      ),
    );
    const units = Number(
      scalar(
        "select units from public.navigator_provider_usage where month='2026-08' and endpoint='navigator.route';",
      ),
    );
    check(
      '5c: units and requests are counted separately',
      units === 7 && reqs === 1,
      `${units}/${reqs}`,
    );

    /* Two endpoints, different weights, one shared month total. */
    const s = reserve(UID_A, 'navigator.destination-search', 2, '2026-08', 1000, 1000);
    check('5d: a second endpoint adds to the same month total', s.globalUnits === 9, s.globalUnits);
    const rows = Number(
      scalar("select count(*) from public.navigator_provider_usage where month='2026-08';"),
    );
    check('5e: …while staying separable per endpoint', rows === 2, rows);

    /* A weight can be the thing that crosses the ceiling. */
    const over = reserve(UID_B, 'navigator.route', 5, '2026-08', 11, 1000);
    check(
      '5f: a weight that would cross the threshold is refused whole',
      !over.allowed,
      over.reason,
    );
  }

  /* ===================================================================== *
   * 6. MONTH ROLLOVER
   * ===================================================================== */
  {
    resetLedger();
    reserve(UID_A, 'navigator.route', 9, '2026-08', 10, 1000);
    const aug = reserve(UID_A, 'navigator.route', 5, '2026-08', 10, 1000);
    check('6a: August refuses once its threshold is reached', !aug.allowed);
    const sep = reserve(UID_A, 'navigator.route', 5, '2026-09', 10, 1000);
    check('6b: September is a separate bucket and allows again', sep.allowed, sep.reason);
    check(
      '6c: …starting from zero, not carrying August forward',
      sep.globalUnits === 5,
      sep.globalUnits,
    );
    const months = sql(
      "select month || ':' || units from public.navigator_provider_month order by month;",
    )
      .split('\n')
      .filter(Boolean);
    check('6d: the two months are stored independently', months.length === 2, months);
    /* The database enforces the bucket shape, so a malformed month cannot open
     * a brand-new unbounded bucket. */
    let badMonthRejected = false;
    try {
      sql(`insert into public.navigator_provider_month (month, units) values ('2026-13', 0);`);
    } catch {
      badMonthRejected = true;
    }
    check('6e: an impossible month is rejected by the check constraint', badMonthRejected);
  }

  /* ===================================================================== *
   * 7. LIMIT-REACHED AND INVALID INPUT
   * ===================================================================== */
  {
    resetLedger();
    const zero = reserve(UID_A, 'navigator.route', 0, '2026-08', 10, 10);
    check(
      '7a: a zero-unit reservation is refused as invalid',
      !zero.allowed && zero.reason === 'invalid-request',
      zero.reason,
    );
    const unknown = reserve(UID_A, 'navigator.made-up', 1, '2026-08', 10, 10);
    check(
      '7b: an unknown endpoint is refused',
      !unknown.allowed && unknown.reason === 'unknown-endpoint',
      unknown.reason,
    );
    check(
      '7c: neither wrote anything to the ledger',
      Number(scalar('select count(*) from public.navigator_provider_month;')) === 0,
    );
    const negThreshold = reserve(UID_A, 'navigator.route', 1, '2026-08', 0, 10);
    check('7d: a zero threshold refuses rather than allowing everything', !negThreshold.allowed);
  }

  /* ===================================================================== *
   * 8. RLS AND CROSS-USER ISOLATION
   * ===================================================================== */
  {
    sql(`
      insert into public.navigator_profiles
        (user_id, first_name, email, privacy_accepted_at, consent_copy_version)
      values
        ('${UID_A}', 'DriverA', 'live-test-a@example.invalid', now(), 'live-test'),
        ('${UID_B}', 'DriverB', 'live-test-b@example.invalid', now(), 'live-test')
      on conflict (user_id) do nothing;

      insert into public.navigator_state (user_id, domain, payload, payload_version)
      values
        ('${UID_A}', 'truck', '{"heightFt": 13.5}'::jsonb, 1),
        ('${UID_B}', 'truck', '{"heightFt": 12.0}'::jsonb, 1)
      on conflict (user_id, domain) do nothing;
    `);

    const asA = {
      role: 'authenticated',
      claims: JSON.stringify({ sub: UID_A, role: 'authenticated' }),
    };
    const asB = {
      role: 'authenticated',
      claims: JSON.stringify({ sub: UID_B, role: 'authenticated' }),
    };
    const asAnon = { role: 'anon', claims: JSON.stringify({ role: 'anon' }) };

    check(
      '8a: a driver sees their own state row',
      Number(scalar('select count(*) from public.navigator_state;', asA)) === 1,
    );
    check(
      "8b: …and NOT the other driver's — cross-user read returns zero rows",
      scalar(`select count(*) from public.navigator_state where user_id = '${UID_B}';`, asA) ===
        '0',
    );
    check(
      '8c: the other driver sees exactly the mirror image',
      scalar(`select count(*) from public.navigator_state where user_id = '${UID_A}';`, asB) ===
        '0',
    );
    /*
     * anon is refused OUTRIGHT, not merely filtered to zero rows.
     *
     * Migration 050 revokes all privileges on both tables from `anon` on top
     * of the RLS policies, so an unauthenticated caller cannot reach the
     * table at all. That is the stronger of the two guarantees and it is
     * worth asserting as itself: "returns no rows" and "cannot be queried"
     * fail differently the day someone adds a permissive policy by hand.
     */
    let anonDeniedState = false;
    let anonStateErr = '';
    try {
      sql('select count(*) from public.navigator_state;', asAnon);
    } catch (e) {
      anonDeniedState = true;
      anonStateErr = e.message;
    }
    check('8d: an anonymous caller cannot read navigator_state at all', anonDeniedState);
    check(
      '8d2: …refused by a revoked grant, not merely an empty policy result',
      /permission denied/i.test(anonStateErr),
      anonStateErr.slice(0, 120),
    );
    let anonDeniedProfiles = false;
    try {
      sql('select count(*) from public.navigator_profiles;', asAnon);
    } catch {
      anonDeniedProfiles = true;
    }
    check('8d3: nor navigator_profiles', anonDeniedProfiles);
    check(
      '8e: a driver sees only their own profile',
      scalar('select count(*) from public.navigator_profiles;', asA) === '1',
    );

    /* WITH CHECK: a driver must not be able to leave a row behind that belongs
     * to someone else — on insert OR on update. */
    let insertBlocked = false;
    try {
      sql(
        `insert into public.navigator_state (user_id, domain, payload, payload_version)
         values ('${UID_B}', 'route_prefs', '{"avoidTolls": true}'::jsonb, 1);`,
        asA,
      );
    } catch {
      insertBlocked = true;
    }
    check('8f: a driver cannot insert a row owned by someone else', insertBlocked);

    let updateBlocked = false;
    try {
      const out = sql(
        `update public.navigator_state set user_id = '${UID_B}'
          where user_id = '${UID_A}' and domain = 'truck' returning 1;`,
        asA,
      );
      updateBlocked = !out.split('\n').filter(Boolean).length;
    } catch {
      updateBlocked = true;
    }
    check('8g: nor move their own row to another owner on the way out', updateBlocked);

    check(
      '8h: the row is still owned by its original driver',
      scalar(
        `select user_id from public.navigator_state where domain='truck' and user_id='${UID_A}';`,
      ) === UID_A,
    );

    /* ------------------------------------------------------------------ *
     * THE HOLE RLS CANNOT COVER
     * ------------------------------------------------------------------ *
     * Everything above tests the policies, and the policies were fine. They
     * were also not the whole answer, and this is the section that found it.
     *
     * Row level security filters SELECT, INSERT, UPDATE and DELETE. `truncate`
     * is authorised by the TABLE PRIVILEGE ALONE and no policy is consulted.
     * So a table can pass every check from 8a to 8h — a driver sees only their
     * own row, cannot delete anyone else's, cannot re-own one — and still be
     * emptiable in full by any one of those drivers.
     *
     * On Supabase that is the DEFAULT position rather than an unlucky one.
     * The project bootstrap grants ALL on every table in `public` to
     * `authenticated`, so a migration that revokes from `anon` and then grants
     * three verbs to `authenticated` has changed nothing: the grant is
     * additive and TRUNCATE was already held. Migration 050 shipped in exactly
     * that shape. 052 is the repair; these four checks are what makes it
     * impossible to lose again.
     *
     * Asserted with rows present, because a truncate of an empty table
     * succeeds and proves nothing about what was destroyed.
     */
    sql(`reset role;
         insert into public.navigator_state (user_id, domain, payload, payload_version)
           values ('${UID_B}', 'route_prefs', '{"avoidTolls": true}'::jsonb, 1)
           on conflict do nothing;`);

    const profilesBefore = Number(scalar('select count(*) from public.navigator_profiles;'));
    const stateBefore = Number(scalar('select count(*) from public.navigator_state;'));
    check(
      '8k: both drivers have rows to destroy, so the next checks mean something',
      profilesBefore >= 2 && stateBefore >= 2,
      `profiles=${profilesBefore} state=${stateBefore}`,
    );

    let truncProfiles = false;
    try {
      sql('truncate public.navigator_profiles;', asA);
    } catch {
      truncProfiles = true;
    }
    check('8l: a signed-in driver cannot TRUNCATE navigator_profiles', truncProfiles);

    let truncState = false;
    try {
      sql('truncate public.navigator_state;', asA);
    } catch {
      truncState = true;
    }
    check('8m: nor navigator_state', truncState);

    sql('reset role;');
    check(
      '8n: every driver still has their rows',
      Number(scalar('select count(*) from public.navigator_profiles;')) === profilesBefore &&
        Number(scalar('select count(*) from public.navigator_state;')) === stateBefore,
    );
  }

  /* ===================================================================== *
   * 9. THE RESERVATION FUNCTION IS NOT REACHABLE ANONYMOUSLY
   * ===================================================================== */
  {
    const asAnon = { role: 'anon', claims: JSON.stringify({ role: 'anon' }) };
    const asAuthed = { role: 'authenticated', claims: JSON.stringify({ sub: UID_A }) };

    let anonBlocked = false;
    let anonError = '';
    try {
      sql(
        `select * from ${RESERVE}('${UID_A}'::uuid, 'navigator.route', 1, '2026-08', 10, 10);`,
        asAnon,
      );
    } catch (e) {
      anonBlocked = true;
      anonError = e.message;
    }
    check('9a: anon CANNOT execute the reservation function', anonBlocked, anonError.slice(0, 120));
    check(
      '9b: …because execute was revoked from public and granted only to authenticated',
      /permission denied/i.test(anonError),
      anonError.slice(0, 120),
    );

    /* An authenticated driver may reserve — through the function only. */
    let authedOk = false;
    try {
      sql(
        `select * from ${RESERVE}('${UID_A}'::uuid, 'navigator.route', 1, '2026-08', 10, 10);`,
        asAuthed,
      );
      authedOk = true;
    } catch (e) {
      authedOk = false;
      anonError = e.message;
    }
    check('9c: an authenticated caller may execute it', authedOk, anonError.slice(0, 160));

    /* But may not read or write the ledger directly. */
    for (const t of [
      'navigator_provider_month',
      'navigator_provider_usage',
      'navigator_provider_user_usage',
    ]) {
      let denied = false;
      try {
        sql(`select count(*) from public.${t};`, asAuthed);
      } catch {
        denied = true;
      }
      check(`9d: authenticated cannot read public.${t} directly`, denied);

      let anonDenied = false;
      try {
        sql(`select count(*) from public.${t};`, asAnon);
      } catch {
        anonDenied = true;
      }
      check(`9e: anon cannot read public.${t} either`, anonDenied);
    }

    let viewDenied = false;
    try {
      sql('select count(*) from public.navigator_provider_usage_report;', asAuthed);
    } catch {
      viewDenied = true;
    }
    check('9f: the admin usage report view is not readable by a driver', viewDenied);
  }

  /* ===================================================================== *
   * 10. NO PII, NO LOCATION, IN THE USAGE RECORDS
   * ===================================================================== *
   * Read off the live catalog rather than the migration text — this is what the
   * server actually built.
   */
  {
    const cols = sql(`
      select table_name || '.' || column_name
        from information_schema.columns
       where table_schema = 'public'
         and table_name in ('navigator_provider_month','navigator_provider_usage','navigator_provider_user_usage')
       order by 1;
    `)
      .split('\n')
      .filter(Boolean);

    check('10a: the usage tables exist and have columns', cols.length > 0, cols.length);
    for (const [what, re] of [
      ['an email', /email/i],
      ['a phone', /phone/i],
      ['a name', /name$|first_name|last_name/i],
      ['a position', /lat|lng|latitude|longitude|position|coord/i],
      ['a destination', /destination|dest/i],
      ['search text', /search|query/i],
      ['a route', /route|geometry|polyline|maneuver|waypoint/i],
      ['movement', /speed|heading|odometer|trail/i],
      ['an IP or agent', /\bip\b|ip_address|user_agent/i],
    ]) {
      const hits = cols.filter((c) => re.test(c.split('.')[1]));
      check(`10b: no usage column holds ${what}`, hits.length === 0, hits);
    }
    check(
      '10c: the only identifier is user_id, on the per-user table alone',
      cols.filter((c) => c.endsWith('.user_id')).join(',') ===
        'navigator_provider_user_usage.user_id',
      cols.filter((c) => c.endsWith('.user_id')),
    );

    const viewCols = sql(`
      select column_name from information_schema.columns
       where table_schema='public' and table_name='navigator_provider_usage_report' order by 1;
    `)
      .split('\n')
      .filter(Boolean);
    check('10d: the admin view exposes no user id', !viewCols.includes('user_id'), viewCols);

    /* And the state table cannot be widened to hold a location without a
     * reviewed migration — the check constraint is the enforcement. */
    let badDomain = false;
    try {
      sql(
        `insert into public.navigator_state (user_id, domain, payload, payload_version)
         values ('${UID_A}', 'last_position', '{"lat":35.0,"lng":-85.0}'::jsonb, 1);`,
      );
    } catch {
      badDomain = true;
    }
    check('10e: a location-shaped sync domain is refused by the database', badDomain);
  }

  /* ===================================================================== *
   * 11. THE GUARD'S DEPENDENCY, ACTUALLY TAKEN AWAY
   * ===================================================================== *
   * The hermetic suite proves the MAPPING — an RPC that errors becomes
   * `guard-unavailable`, and the gate turns that into a refusal. What it
   * cannot prove is the premise, because it has no database to remove.
   *
   * So remove it. The reservation function is renamed out from under a caller
   * that still asks for it by name, which is what a half-applied migration, a
   * rolled-back schema or a dropped function looks like from the
   * application's side. The call must ERROR.
   *
   * An error is the ONLY acceptable outcome and the reason is one-directional:
   * a call that answered "allowed" with no store behind it would be spend
   * authorised by nothing at all. There is no safe way to fail open here.
   */
  {
    resetLedger();
    const M = '2026-05';

    const before = reserve(UID_A, 'navigator.route', 1, M, 100, 50);
    check('11a: the guard answers normally while its store is present', before.allowed);

    // --- the dependency, gone -------------------------------------------
    sql(`alter function ${RESERVE}(uuid, text, integer, text, integer, integer)
           rename to navtest_reserve_parked;`);

    let missingErr = '';
    try {
      reserve(UID_A, 'navigator.route', 1, M, 100, 50);
    } catch (e) {
      missingErr = e.message;
    }
    check(
      '11b: with the function gone the call ERRORS — it does not answer "allowed"',
      /does not exist/i.test(missingErr),
      missingErr.split('\n')[0],
    );

    sql(`alter function public.navtest_reserve_parked(uuid, text, integer, text, integer, integer)
           rename to navigator_reserve_provider_units;`);
    const after = reserve(UID_A, 'navigator.route', 1, M, 100, 50);
    check('11c: and the guard recovers once the store is back', after.allowed);
    check(
      '11d: the outage neither lost nor invented units',
      after.userUnits === 2 && after.globalUnits === 2,
      `global=${after.globalUnits} user=${after.userUnits}`,
    );

    // --- reachable, but not permitted, is the same answer ----------------
    sql(`revoke execute on function ${RESERVE}(uuid, text, integer, text, integer, integer)
           from authenticated;`);
    let deniedErr = '';
    try {
      sql(
        `select * from ${RESERVE}('${UID_A}'::uuid, 'navigator.route', 1, ${quote(M)}, 100, 50);`,
        { role: 'authenticated', claims: JSON.stringify({ sub: UID_A, role: 'authenticated' }) },
      );
    } catch (e) {
      deniedErr = e.message;
    }
    check(
      '11e: a reachable-but-forbidden guard errors too, not opens',
      /permission denied/i.test(deniedErr),
      deniedErr.split('\n')[0],
    );
    sql(`reset role;
         grant execute on function ${RESERVE}(uuid, text, integer, text, integer, integer)
           to authenticated;`);

    /* The application half of the same claim. The database erroring is only
     * useful if the code above it turns that into a refusal rather than a
     * shrug, so the two files that decide are read here rather than assumed. */
    const reservationSrc = readFileSync('src/lib/navigator-api/usage-reservation.ts', 'utf8');
    const gateSrc = readFileSync('src/lib/navigator-api/metered-gate.ts', 'utf8');
    check(
      '11f: an RPC error maps to guard-unavailable',
      /if \(error\) return \{ allowed: false, reason: 'guard-unavailable' \}/.test(reservationSrc),
    );
    check(
      '11g: a thrown error maps to guard-unavailable',
      /\} catch \{\s*return \{ allowed: false, reason: 'guard-unavailable' \};\s*\}/.test(
        reservationSrc,
      ),
    );
    check(
      '11h: an unrecognized response shape maps to guard-unavailable',
      /typeof row\.allowed !== 'boolean'/.test(reservationSrc),
    );
    check(
      '11i: no failure branch in the reservation returns allowed: true',
      reservationSrc.split('allowed: true').length - 1 === 1,
    );
    check(
      '11j: the gate refuses on any not-allowed reservation, whatever the reason',
      /if \(!reservation\.allowed\)/.test(gateSrc),
    );
    check(
      '11k: guard-unavailable is answered 503, not allowed through',
      /reservation\.reason === 'global-threshold' \|\| reservation\.reason === 'user-limit'\s*\?\s*429\s*:\s*503/.test(
        gateSrc,
      ),
    );
  }

  /* ===================================================================== *
   * 12. AN ACCEPTED RESERVATION IS NEVER GIVEN BACK
   * ===================================================================== *
   * The no-refund rule exists because a provider call that fails partway
   * leaves us unable to say whether the provider counted it. Refunding would
   * therefore under-count precisely during an incident.
   *
   * The distinction this section has to keep straight — and it is the one a
   * careless test would blur — is between two subtractions that look alike:
   *
   *   THE UNDO, which is legitimate. When the global check refuses, the
   *   per-user increment made moments earlier inside the SAME call is rolled
   *   back. Nothing was ever reserved; §4 already pins this.
   *
   *   A REFUND, which must not exist. Units that were ACCEPTED, returned
   *   later because the provider call went wrong.
   *
   * So: prove no path exists to reduce an accepted total, and prove that
   * everything which happens after an acceptance — a later refusal, an error,
   * an outage — leaves it exactly where it was.
   */
  {
    resetLedger();
    const M = '2026-06';

    const ok = reserve(UID_A, 'navigator.route', 4, M, 10, 10);
    check(
      '12a: units are reserved before the provider is called',
      ok.allowed && ok.userUnits === 4,
    );

    /* Provider billing is uncertain in exactly these shapes: the call times
     * out, the call errors, the guard's own store goes away mid-flight. None
     * of them may return a unit. The application performs no compensating
     * write in any of these cases — so the observable claim is that the totals
     * are untouched by everything that follows the acceptance. */
    sql(`alter function ${RESERVE}(uuid, text, integer, text, integer, integer)
           rename to navtest_reserve_parked;`);
    try {
      reserve(UID_A, 'navigator.route', 1, M, 10, 10);
    } catch {
      /* expected — the store is gone, mirroring a failure after reservation */
    }
    sql(`alter function public.navtest_reserve_parked(uuid, text, integer, text, integer, integer)
           rename to navigator_reserve_provider_units;`);

    const survivedUser = scalar(
      `select units from public.navigator_provider_user_usage
        where month = ${quote(M)} and user_id = '${UID_A}';`,
    );
    const survivedMonth = scalar(
      `select units from public.navigator_provider_month where month = ${quote(M)};`,
    );
    check(
      '12b: an outage after the reservation refunds nothing',
      survivedUser === '4' && survivedMonth === '4',
      `user=${survivedUser} month=${survivedMonth}`,
    );

    // A later refusal must not claw back what was already accepted.
    const refused = reserve(UID_A, 'navigator.route', 9, M, 10, 10);
    check('12c: an over-limit request is refused', !refused.allowed);
    check(
      '12d: …and the refusal leaves the accepted units alone',
      scalar(
        `select units from public.navigator_provider_user_usage
          where month = ${quote(M)} and user_id = '${UID_A}';`,
      ) === '4',
    );

    /* Nothing in the schema can hand a unit back. If a refund ever ships it
     * will arrive as a function, so the catalog is the right place to look —
     * and the check reads the live catalog, not the migration text. */
    const publicFns = sql(`
      select p.proname
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname = 'public'
       order by 1;
    `)
      .split('\n')
      .filter(Boolean);
    const refundish = publicFns.filter((f) =>
      /refund|release|credit|decrement|give_?back|unreserve|return_units/i.test(f),
    );
    check('12e: the schema exposes no refund-shaped function', refundish.length === 0, refundish);

    const writers = publicFns.filter((f) => /navigator_provider|reserve_provider/i.test(f));
    check(
      '12f: exactly one function owns the usage tables',
      writers.length === 1 && writers[0] === 'navigator_reserve_provider_units',
      writers,
    );

    /* The one subtraction in the shipped body is the undo, and it must stay
     * the only one. A second would be a refund however it were named. */
    const body = sql(
      `select prosrc from pg_proc where proname = 'navigator_reserve_provider_units';`,
    );
    const subtractions = (body.match(/units\s*-\s*p_units/g) ?? []).length;
    check(
      '12g: the function body subtracts units exactly once — the refused-global undo',
      subtractions === 1,
      subtractions,
    );
    check(
      '12h: …and that undo sits inside the refusal branch, not on the accepted path',
      /if v_global_units is null then[\s\S]{0,400}units\s*-\s*p_units/.test(body),
    );

    const guardSrc = readFileSync('src/lib/navigator-api/usage-guard.ts', 'utf8');
    check(
      '12i: refundIsPermitted() returns false, by name, so a change has to argue with it',
      /export function refundIsPermitted\(\): false \{\s*return false;\s*\}/.test(guardSrc),
    );
  }

  /* ===================================================================== *
   * 13. THE SCHEMA THE MIGRATIONS PROMISED
   * ===================================================================== *
   * Read entirely off the live catalog. The migration text saying `create
   * index` is not evidence that an index exists; `pg_indexes` is. Sections 8
   * and 9 prove the RLS BEHAVIOUR, which is the stronger claim — this section
   * proves the objects are all present, so a partially-applied migration
   * cannot pass by being silently smaller than it should be.
   */
  {
    function catalog(q) {
      return sql(q).split('\n').filter(Boolean);
    }

    const tables = catalog(`
      select table_name from information_schema.tables
       where table_schema='public' and table_type='BASE TABLE' order by 1;`);
    for (const t of [
      'email_consents',
      'email_unsubscribes',
      'navigator_profiles',
      'navigator_state',
      'navigator_provider_month',
      'navigator_provider_usage',
      'navigator_provider_user_usage',
    ]) {
      check(`13a: table ${t} exists`, tables.includes(t));
    }

    const views = catalog(`
      select table_name from information_schema.views
       where table_schema='public' order by 1;`);
    for (const v of [
      'email_subscription_status',
      'navigator_marketing_contacts',
      'navigator_provider_usage_report',
    ]) {
      check(`13b: view ${v} exists`, views.includes(v));
    }

    const indexes = catalog(`
      select indexname from pg_indexes where schemaname='public' order by 1;`);
    for (const i of [
      'navigator_profiles_email_idx',
      'navigator_profiles_created_idx',
      'navigator_state_user_idx',
      'navigator_provider_user_usage_month_idx',
    ]) {
      check(`13c: index ${i} exists`, indexes.includes(i));
    }

    const triggers = catalog(`
      select c.relname || '.' || t.tgname
        from pg_trigger t
        join pg_class c on c.oid = t.tgrelid
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname='public' and not t.tgisinternal order by 1;`);
    for (const tg of ['navigator_profiles.set_updated_at', 'navigator_state.set_updated_at']) {
      check(`13d: trigger ${tg} exists`, triggers.includes(tg));
    }

    const constraints = catalog(`
      select conname from pg_constraint c
        join pg_class r on r.oid = c.conrelid
        join pg_namespace n on n.oid = r.relnamespace
       where n.nspname='public' and c.contype='c' order by 1;`);
    for (const c of [
      'navigator_profiles_email_normalized',
      'navigator_profiles_phone_e164_shape',
      'navigator_profiles_phone_pairing',
      'navigator_profiles_signup_source_known',
      'navigator_state_domain_known',
      'navigator_state_payload_is_object',
      'navigator_state_payload_bounded',
      'navigator_provider_month_shape',
      'navigator_provider_usage_endpoint_known',
      'navigator_provider_user_usage_month_shape',
    ]) {
      check(`13e: check constraint ${c} exists`, constraints.includes(c));
    }

    // The reservation function, and the two properties that make it safe to
    // grant to a driver at all.
    const fn = sql(`
      select p.prosecdef::text || '|' || coalesce(array_to_string(p.proconfig, ','), '')
        from pg_proc p join pg_namespace n on n.oid = p.pronamespace
       where n.nspname='public' and p.proname='navigator_reserve_provider_units';`);
    check('13f: the reservation function is SECURITY DEFINER', fn.startsWith('true|'), fn);
    check('13g: …with a pinned search_path', /search_path=public,\s*pg_temp/.test(fn), fn);

    // RLS enabled on all five account-owned tables.
    for (const t of [
      'navigator_profiles',
      'navigator_state',
      'navigator_provider_month',
      'navigator_provider_usage',
      'navigator_provider_user_usage',
    ]) {
      check(
        `13h: RLS is enabled on ${t}`,
        scalar(`select relrowsecurity::text from pg_class
                 where oid = 'public.${t}'::regclass;`) === 'true',
      );
    }

    const policies = catalog(`
      select tablename || '.' || policyname from pg_policies
       where schemaname='public' and tablename like 'navigator_%' order by 1;`);
    for (const p of [
      'navigator_profiles.navigator_profiles_select_own',
      'navigator_profiles.navigator_profiles_insert_own',
      'navigator_profiles.navigator_profiles_update_own',
      'navigator_state.navigator_state_select_own',
      'navigator_state.navigator_state_insert_own',
      'navigator_state.navigator_state_update_own',
      'navigator_state.navigator_state_delete_own',
    ]) {
      check(`13i: policy ${p} exists`, policies.includes(p));
    }
    /* The usage tables are deliberately policy-free: no policy match means no
     * rows, and the SECURITY DEFINER function is the whole access path. A
     * policy appearing here would be a widening nobody reviewed. */
    const usagePolicies = policies.filter((p) => p.startsWith('navigator_provider_'));
    check(
      '13j: the usage tables carry no policy at all — the function is the only path',
      usagePolicies.length === 0,
      usagePolicies,
    );

    /* Grants. `anon` is the one that matters: it is the role a browser holds
     * with the publishable key, so anything granted to it is granted to the
     * internet. */
    const anonGrants = catalog(`
      select table_name || ':' || privilege_type from information_schema.role_table_grants
       where grantee='anon' and table_schema='public'
         and table_name in ('navigator_profiles','navigator_state','navigator_provider_month',
                            'navigator_provider_usage','navigator_provider_user_usage',
                            'navigator_marketing_contacts','navigator_provider_usage_report')
       order by 1;`);
    check(
      '13k: anon holds no privilege on any account or usage object',
      anonGrants.length === 0,
      anonGrants,
    );

    const authGrants = catalog(`
      select table_name || ':' || privilege_type from information_schema.role_table_grants
       where grantee='authenticated' and table_schema='public'
         and table_name like 'navigator_%' order by 1;`);
    const expectedAuth = [
      'navigator_profiles:INSERT',
      'navigator_profiles:SELECT',
      'navigator_profiles:UPDATE',
      'navigator_state:DELETE',
      'navigator_state:INSERT',
      'navigator_state:SELECT',
      'navigator_state:UPDATE',
    ].sort();
    check(
      '13l: authenticated holds exactly the account-table grants and nothing on usage',
      [...authGrants].sort().join(',') === expectedAuth.join(','),
      authGrants,
    );

    const svcViews = catalog(`
      select table_name from information_schema.role_table_grants
       where grantee='service_role' and table_schema='public' and privilege_type='SELECT'
         and table_name in ('navigator_marketing_contacts','navigator_provider_usage_report')
       order by 1;`);
    check(
      '13m: both admin views are readable by service_role alone',
      svcViews.includes('navigator_marketing_contacts') &&
        svcViews.includes('navigator_provider_usage_report'),
      svcViews,
    );

    const fnGrants = catalog(`
      select r.rolname
        from pg_proc p, aclexplode(p.proacl) a
        join pg_roles r on r.oid = a.grantee
       where p.proname='navigator_reserve_provider_units' and a.privilege_type='EXECUTE'
       order by 1;`);
    check(
      '13n: execute on the reservation function is granted to authenticated, never anon',
      fnGrants.includes('authenticated') && !fnGrants.includes('anon'),
      fnGrants,
    );

    /* The generic form of the 050 defect, so it cannot come back under a
     * different table name. TRUNCATE is the dangerous verb because no policy
     * filters it; this asks the catalog rather than any particular migration,
     * so a table added next year is covered by a test written today. */
    const dangerous = catalog(`
      select grantee || ' holds ' || privilege_type || ' on ' || table_name
        from information_schema.role_table_grants
       where table_schema='public'
         and grantee in ('anon','authenticated')
         and privilege_type in ('TRUNCATE','REFERENCES','TRIGGER')
         and table_name like 'navigator_%'
       order by 1;`);
    check(
      '13p: no Navigator table grants TRUNCATE, REFERENCES or TRIGGER to anon or authenticated',
      dangerous.length === 0,
      dangerous,
    );

    const anonAnywhere = catalog(`
      select table_name || ':' || privilege_type from information_schema.role_table_grants
       where table_schema='public' and grantee='anon' and table_name like 'navigator_%' order by 1;`);
    check(
      '13q: anon holds nothing on any Navigator object at all',
      anonAnywhere.length === 0,
      anonAnywhere,
    );

    /* Rollback instructions are part of the deliverable, not a nicety: a
     * migration nobody can undo is one nobody should apply. Asserted on the
     * files so a future migration cannot ship without them. */
    for (const m of MIGRATIONS) {
      const text = readFileSync(m, 'utf8');
      const heading = /^-- ROLLBACK$/m.test(text);
      /* The reversal has to be spelled out as SQL somebody can run, not
       * described in prose. Which verb reverses it depends on what the
       * migration did: one that creates objects reverses with `drop`, while
       * 052 changes nothing but privileges and reverses with `grant`. Both
       * count; neither an empty heading nor a paragraph of intent does. */
      const after = text.split(/^-- ROLLBACK$/m)[1] ?? '';
      const reversal = /\b(drop (table|view|index|function)|grant |revoke )/i.test(after);
      check(
        `13o: ${m.split('/').pop()} documents its rollback as runnable SQL`,
        heading && reversal,
        heading ? 'heading present, no reversal statement' : 'no ROLLBACK heading',
      );
    }
  }

  /* ===================================================================== *
   * 13B. ACCOUNT DELETION REALLY CASCADES
   * ===================================================================== *
   * `deleteAccountAction` makes ONE call — `auth.admin.deleteUser` — and
   * relies entirely on the foreign keys to remove everything the driver owns.
   * That is the right design, and it is only correct if the cascade is real.
   * An `on delete cascade` that was written but not applied would leave the
   * application deleting an account and silently orphaning the driver's
   * profile, their synced truck and their clocks — data the product has just
   * promised, on screen, to have removed.
   *
   * Read as behaviour rather than as catalog metadata: delete the auth row,
   * then count what survived.
   */
  {
    const UID_D = '44444444-4444-4444-8444-444444444444';
    sql(`
      reset role;
      insert into auth.users (id, email) values ('${UID_D}', 'live-test-d@example.invalid')
        on conflict (id) do nothing;
      insert into public.navigator_profiles (user_id, first_name, email, consent_copy_version, privacy_accepted_at)
        values ('${UID_D}', 'D', 'live-test-d@example.invalid', 'v-test', now())
        on conflict (user_id) do nothing;
      insert into public.navigator_state (user_id, domain, payload, payload_version) values
        ('${UID_D}', 'truck', '{"a":1}'::jsonb, 1),
        ('${UID_D}', 'hos_clocks', '{"b":2}'::jsonb, 1),
        ('${UID_D}', 'route_prefs', '{"c":3}'::jsonb, 1)
        on conflict do nothing;
      insert into public.navigator_provider_user_usage (month, user_id, units, requests)
        values ('2026-07', '${UID_D}', 5, 5) on conflict do nothing;
    `);

    const owned = () => ({
      profile: scalar(`select count(*) from public.navigator_profiles where user_id='${UID_D}';`),
      state: scalar(`select count(*) from public.navigator_state where user_id='${UID_D}';`),
      usage: scalar(
        `select count(*) from public.navigator_provider_user_usage where user_id='${UID_D}';`,
      ),
    });

    const before = owned();
    check(
      '13r: the driver owns a profile, three synced domains and a usage row',
      before.profile === '1' && before.state === '3' && before.usage === '1',
      JSON.stringify(before),
    );

    // Exactly what deleteAccountAction does, and nothing else.
    sql(`delete from auth.users where id = '${UID_D}';`);

    const after = owned();
    check('13s: deleting the account removes the profile', after.profile === '0');
    check('13t: …and every synced record with it', after.state === '0', after.state);
    check('13u: …and the per-user usage row', after.usage === '0', after.usage);

    /* The consent evidence is deliberately NOT cascaded — it is an
     * append-only record of what a person agreed to, keyed by email rather
     * than by user id, and a compliance record that vanishes with the account
     * is not a compliance record. Asserted so that "it survives" stays a
     * decision rather than becoming an accident. */
    const consentFk = scalar(`
      select count(*) from information_schema.table_constraints tc
        join information_schema.constraint_column_usage ccu
          on ccu.constraint_name = tc.constraint_name
       where tc.table_name = 'email_consents' and tc.constraint_type = 'FOREIGN KEY'
         and ccu.table_name = 'users';`);
    check(
      '13v: consent evidence carries no foreign key to auth.users, so deletion cannot erase it',
      consentFk === '0',
      consentFk,
    );
  }

  /* ===================================================================== *
   * 14. CLEAN UP
   * ===================================================================== */
  {
    let cleaned = true;
    try {
      sql(`
        reset role;
        delete from public.navigator_state where user_id in ('${UID_A}','${UID_B}');
        delete from public.navigator_profiles where user_id in ('${UID_A}','${UID_B}');
        delete from public.navigator_provider_user_usage where user_id in ('${UID_A}','${UID_B}');
        truncate public.navigator_provider_month, public.navigator_provider_usage;
        delete from auth.users where id in ('${UID_A}','${UID_B}');
      `);
    } catch (e) {
      cleaned = false;
      console.log(`cleanup error: ${e.message}`);
    }
    check('11a: test fixtures cleaned up', cleaned);
    check(
      '11b: no test rows remain in auth.users',
      scalar(`select count(*) from auth.users where id in ('${UID_A}','${UID_B}');`) === '0',
    );
    check(
      '11c: no test rows remain in the usage ledger',
      scalar('select count(*) from public.navigator_provider_user_usage;') === '0',
    );
    check(
      '11d: no test rows remain in navigator_state',
      scalar('select count(*) from public.navigator_state;') === '0',
    );
  }
}

await section2();
await section3();
await section4to11();

sql('drop table if exists public._navtest_results;');

console.log(`\nnavigator live-postgres: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`failing: ${failures.join(' | ')}`);
  process.exit(1);
}
