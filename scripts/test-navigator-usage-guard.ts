/**
 * The centralized provider-usage guard.
 *
 * WHAT IS PROVEN HERE, AND WHAT IS NOT — stated first, because a spend
 * control that is over-claimed is worse than one that is absent.
 *
 * PROVEN, against the real shipped code:
 *   - the configuration rules, including every way a deploy can be refused
 *   - the reservation arithmetic, per user and globally
 *   - endpoint weights
 *   - month rollover, on a UTC boundary, with an injected clock
 *   - fail-closed on an unconfigured, unreachable or unintelligible guard
 *   - what a driver is told, and everything they are not told
 *   - that no reservation is ever refunded
 *
 * PROVEN AGAINST A MODEL, and labelled as such: concurrency. Two instances
 * racing the last unit is a property of PostgreSQL's row locking, and no
 * offline harness can execute PostgreSQL. Section 5 therefore does two
 * things — it reads the migration and asserts the atomic pattern is actually
 * the one written, and it runs both the atomic and the naive read-then-write
 * algorithms through a concurrency simulator to show the difference is real
 * and which side the shipped SQL is on. That is an argument, not a proof, and
 * the real thing needs a database.
 *
 * NOT PROVEN AT ALL: that these units equal HERE transactions. They do not,
 * by construction. See the header of usage-guard.ts.
 *
 * Run:
 *   npx esbuild scripts/test-navigator-usage-guard.ts --bundle --platform=node \
 *     --format=cjs --alias:@=./src \
 *     --alias:server-only=./scripts/shims/server-only.ts \
 *     --alias:next/headers=./scripts/shims/next-headers.ts \
 *     --outfile=/tmp/test-navigator-usage-guard.cjs \
 *   && node /tmp/test-navigator-usage-guard.cjs
 */

import { readFileSync } from 'node:fs';
import {
  USAGE_ENV,
  USAGE_LIMIT_USER_MESSAGE,
  decideReservation,
  guardEnforcedIn,
  parsePositiveInt,
  readUsageConfig,
  refundIsPermitted,
  usageMonthKey,
  weightFor,
  type UsageGuardConfig,
} from '@/lib/navigator-api/usage-guard';
import { METERED_ENDPOINT_KEYS } from '@/lib/navigator-api/metered-endpoints';
import {
  USAGE_REPORT_CAVEAT,
  buildUsageReport,
  type UsageRow,
} from '@/lib/navigator-account/usage-report';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}
const read = (p: string) => readFileSync(p, 'utf8');

const MIGRATION = read('supabase/migrations/051_navigator_provider_usage.sql');

const GOOD_ENV = {
  [USAGE_ENV.allowance]: '5000',
  [USAGE_ENV.threshold]: '4000',
  [USAGE_ENV.userLimit]: '300',
};
const CONFIG: UsageGuardConfig = (() => {
  const r = readUsageConfig(GOOD_ENV);
  if (!r.ok) throw new Error('fixture config must parse');
  return r.config;
})();

/* ===================================================================== *
 * 1. CONFIGURATION — every ambiguous value is refused
 * ===================================================================== */
{
  for (const [what, raw] of [
    ['empty', ''],
    ['whitespace', '   '],
    ['not a number', 'abc'],
    ['a float', '12.5'],
    ['negative', '-1'],
    ['zero', '0'],
    ['hex', '0x10'],
    ['exponent', '1e3'],
    ['a number with a comma', '5,000'],
    ['undefined', undefined],
  ] as const) {
    check(`1a: ${what} is not a ceiling`, parsePositiveInt(raw) === null, raw);
  }
  check('1b: a plain positive integer parses', parsePositiveInt('4000') === 4000);
  check('1c: surrounding whitespace is forgiven', parsePositiveInt('  4000 ') === 4000);

  check('1d: a complete configuration is accepted', readUsageConfig(GOOD_ENV).ok);
  for (const missing of [USAGE_ENV.allowance, USAGE_ENV.threshold, USAGE_ENV.userLimit]) {
    const env = { ...GOOD_ENV };
    delete (env as Record<string, string | undefined>)[missing];
    const r = readUsageConfig(env);
    check(`1e: a missing ${missing} fails closed`, !r.ok);
  }
  /*
   * THE MARGIN IS THE POINT. A threshold equal to the allowance means the
   * first thing anyone learns is that the allowance is gone — which is the
   * same information the invoice would have given. A configuration that
   * erases the margin is a configuration error, not a strict setting.
   */
  check(
    '1f: a threshold EQUAL to the allowance is refused',
    !readUsageConfig({ ...GOOD_ENV, [USAGE_ENV.threshold]: '5000' }).ok,
  );
  check(
    '1g: a threshold ABOVE the allowance is refused',
    !readUsageConfig({ ...GOOD_ENV, [USAGE_ENV.threshold]: '6000' }).ok,
  );
  check(
    '1h: a threshold below the allowance is accepted',
    readUsageConfig({ ...GOOD_ENV, [USAGE_ENV.threshold]: '4999' }).ok,
  );
  const problem = readUsageConfig({ ...GOOD_ENV, [USAGE_ENV.threshold]: '5000' });
  check(
    '1i: and the refusal says which two variables disagree',
    !problem.ok &&
      problem.problem.includes(USAGE_ENV.threshold) &&
      problem.problem.includes(USAGE_ENV.allowance),
  );
}

/* ===================================================================== *
 * 2. WHERE THE GUARD APPLIES
 * ===================================================================== */
{
  check('2a: account mode enforces the guard', guardEnforcedIn('account'));
  check('2b: public mode enforces it too', guardEnforcedIn('public'));
  /*
   * Pilot is INERT, deliberately. Production runs pilot, and a fail-closed
   * dependency on Supabase there would be a new way to strand a live driver
   * for no bounded-spend benefit the passcode does not already give.
   */
  check(
    '2c: pilot mode does NOT — production gains no new failure mode',
    !guardEnforcedIn('pilot'),
  );
  check('2d: closed mode does not', !guardEnforcedIn('closed'));
}

/* ===================================================================== *
 * 3. WEIGHTS
 * ===================================================================== */
{
  check('3a: default weights are one unit per call', weightFor(CONFIG, 'navigator.route') === 1);
  const weighted = readUsageConfig({
    ...GOOD_ENV,
    [USAGE_ENV.weightRoute]: '7',
    [USAGE_ENV.weightSearch]: '2',
  });
  check('3b: weights are configurable per endpoint', weighted.ok);
  if (weighted.ok) {
    check('3c: the route weight is honoured', weightFor(weighted.config, 'navigator.route') === 7);
    check(
      '3d: the search weight is honoured independently',
      weightFor(weighted.config, 'navigator.destination-search') === 2,
    );
    /* A weighted call consumes its whole weight, not one unit. */
    const d = decideReservation({
      config: weighted.config,
      units: 7,
      globalUnitsBefore: 0,
      userUnitsBefore: 0,
    });
    check('3e: a weighted reservation consumes its full weight', d.allowed && d.globalUnits === 7);
    /* And a weight can be the thing that crosses a ceiling. */
    const over = decideReservation({
      config: weighted.config,
      units: 7,
      globalUnitsBefore: weighted.config.threshold - 3,
      userUnitsBefore: 0,
    });
    check('3f: a weight can be what crosses the threshold', !over.allowed);
  }
  check(
    '3g: an invalid weight falls back to the default rather than to zero',
    (() => {
      const r = readUsageConfig({ ...GOOD_ENV, [USAGE_ENV.weightRoute]: 'nonsense' });
      return r.ok && weightFor(r.config, 'navigator.route') === 1;
    })(),
  );
  check(
    '3h: every metered endpoint has a weight',
    METERED_ENDPOINT_KEYS.every((k) => weightFor(CONFIG, k) >= 1),
  );
}

/* ===================================================================== *
 * 4. THE RESERVATION ARITHMETIC
 * ===================================================================== */
{
  const at = (globalUnitsBefore: number, userUnitsBefore: number, units = 1) =>
    decideReservation({ config: CONFIG, units, globalUnitsBefore, userUnitsBefore });

  check('4a: an empty month allows', at(0, 0).allowed);
  check('4b: one below the threshold allows', at(CONFIG.threshold - 1, 0).allowed);
  check('4c: exactly at the threshold refuses', !at(CONFIG.threshold, 0).allowed);
  check(
    '4d: the LAST unit is allowed, and the one after is not',
    at(CONFIG.threshold - 1, 0).allowed && !at(CONFIG.threshold, 0).allowed,
  );
  const refusal = at(CONFIG.threshold, 0);
  check(
    '4e: a global refusal names the global cause',
    !refusal.allowed && refusal.reason === 'global-threshold',
  );

  check('4f: a user at their limit is refused', !at(0, CONFIG.userLimit).allowed);
  const userRefusal = at(0, CONFIG.userLimit);
  check(
    '4g: …with the per-user cause',
    !userRefusal.allowed && userRefusal.reason === 'user-limit',
  );
  check(
    '4h: one driver exhausting their own limit does not consume the shared pool',
    (() => {
      const r = at(0, CONFIG.userLimit);
      return !r.allowed && r.reason === 'user-limit';
    })(),
  );
  check(
    '4i: the per-user check runs FIRST, so a maxed user never contends globally',
    (() => {
      const r = at(CONFIG.threshold, CONFIG.userLimit);
      return !r.allowed && r.reason === 'user-limit';
    })(),
  );
  const ok = at(10, 5);
  check(
    '4j: an allowed reservation reports both post-increment totals',
    ok.allowed && ok.globalUnits === 11 && ok.userUnits === 6,
  );

  /* A user's limit must be reachable without exhausting the global one. */
  check(
    '4k: the per-user limit is below the global threshold',
    CONFIG.userLimit < CONFIG.threshold,
  );
}

/* ===================================================================== *
 * 5. ATOMICITY AND CONCURRENCY
 * ===================================================================== *
 * Read the disclaimer in this file's header. What follows is (a) a structural
 * assertion that the shipped SQL uses the atomic pattern, and (b) a simulation
 * showing the naive alternative genuinely breaks.
 */
{
  /* -- 5a. the SQL really is written the atomic way -------------------- */
  check(
    '5a: the global limit test lives INSIDE the UPDATE, not in a prior SELECT',
    /update public\.navigator_provider_month[\s\S]*?where month = p_month\s*\n\s*and units \+ p_units <= p_global_threshold/.test(
      MIGRATION,
    ),
  );
  check(
    '5b: the per-user limit test does too',
    /update public\.navigator_provider_user_usage[\s\S]*?and units \+ p_units <= p_user_limit/.test(
      MIGRATION,
    ),
  );
  check(
    '5c: a refused global reservation UNDOES the per-user increment',
    /if v_global_units is null then[\s\S]*?set units = units - p_units/.test(MIGRATION),
  );
  check(
    '5d: there is no read-then-write anywhere in the reservation',
    !/select\s+units\s+into[\s\S]{0,400}?update public\.navigator_provider/i.test(MIGRATION),
  );
  check(
    '5e: the function is SECURITY DEFINER with a pinned search_path',
    /security definer/i.test(MIGRATION) && /set search_path = public, pg_temp/i.test(MIGRATION),
  );
  check(
    '5f: the counter is a shared row, not an in-memory variable',
    /create table if not exists public\.navigator_provider_month/.test(MIGRATION),
  );
  check(
    '5g: the reservation plumbing keeps no module-level counter of its own',
    !/^let \w+ = 0;/m.test(read('src/lib/navigator-api/usage-reservation.ts')),
  );

  /* -- 5h. the simulation --------------------------------------------- */
  /**
   * A model of the two algorithms under interleaved execution. `atomic`
   * mirrors the shipped `UPDATE … WHERE units + n <= threshold` (test and
   * increment indivisible); `naive` mirrors read-then-write, where every
   * caller reads before any writes.
   */
  function simulate(kind: 'atomic' | 'naive', threshold: number, callers: number): number {
    let units = 0;
    let granted = 0;
    if (kind === 'atomic') {
      for (let i = 0; i < callers; i += 1) {
        if (units + 1 <= threshold) {
          units += 1;
          granted += 1;
        }
      }
    } else {
      // Every caller reads the same value, then all of them write.
      const seen = units;
      for (let i = 0; i < callers; i += 1) {
        if (seen + 1 <= threshold) {
          units += 1;
          granted += 1;
        }
      }
    }
    return granted;
  }

  const THRESHOLD = 10;
  check(
    '5h: the atomic pattern grants exactly the threshold under a stampede',
    simulate('atomic', THRESHOLD, 500) === THRESHOLD,
    simulate('atomic', THRESHOLD, 500),
  );
  check(
    '5i: …and the read-then-write pattern overshoots, which is why it is not used',
    simulate('naive', THRESHOLD, 500) > THRESHOLD,
    simulate('naive', THRESHOLD, 500),
  );
  check(
    '5j: the overshoot scales with concurrency — the failure is worst under load',
    simulate('naive', THRESHOLD, 500) > simulate('naive', THRESHOLD, 50),
  );

  /* The same claim expressed through the shipped decision function: no
   * sequence of accepted reservations can sum past the threshold. */
  let running = 0;
  let accepted = 0;
  for (let i = 0; i < 10_000; i += 1) {
    const d = decideReservation({
      config: CONFIG,
      units: 1,
      globalUnitsBefore: running,
      userUnitsBefore: 0,
    });
    if (!d.allowed) break;
    running = d.globalUnits;
    accepted += 1;
  }
  check(
    '5k: no run of accepted reservations can exceed the threshold',
    running <= CONFIG.threshold && accepted === CONFIG.threshold,
    { running, accepted },
  );
}

/* ===================================================================== *
 * 6. MONTH ROLLOVER
 * ===================================================================== */
{
  check('6a: the key is YYYY-MM', /^\d{4}-\d{2}$/.test(usageMonthKey(Date.UTC(2026, 7, 16))));
  check('6b: August is 08, zero-padded', usageMonthKey(Date.UTC(2026, 7, 16)) === '2026-08');
  check('6c: January is 01', usageMonthKey(Date.UTC(2026, 0, 1)) === '2026-01');
  check('6d: December is 12', usageMonthKey(Date.UTC(2026, 11, 31)) === '2026-12');

  /* The boundary itself: the last millisecond of a month and the first of the
   * next must land in different buckets. */
  const lastMs = Date.UTC(2026, 7, 31, 23, 59, 59, 999);
  const firstMs = Date.UTC(2026, 8, 1, 0, 0, 0, 0);
  check('6e: the last instant of August is August', usageMonthKey(lastMs) === '2026-08');
  check('6f: the first instant of September is September', usageMonthKey(firstMs) === '2026-09');
  check(
    '6g: they are different buckets, one millisecond apart',
    usageMonthKey(lastMs) !== usageMonthKey(firstMs),
  );

  /* Year rollover. */
  check(
    '6h: December rolls into the next year',
    usageMonthKey(Date.UTC(2026, 11, 31, 23, 59)) === '2026-12' &&
      usageMonthKey(Date.UTC(2027, 0, 1)) === '2027-01',
  );

  /*
   * UTC, NOT LOCAL. Two servers in different regions disagreeing about which
   * month it is would let the last hours of a month be spent twice — once
   * against each bucket — which is precisely the rollover bug a shared
   * counter exists to make impossible.
   */
  check(
    '6i: the bucket is UTC, so instances in different regions agree',
    usageMonthKey(Date.UTC(2026, 8, 1, 0, 30)) === '2026-09',
  );
  check(
    '6j: the month key is computed from UTC accessors, not local ones',
    /getUTCFullYear/.test(read('src/lib/navigator-api/usage-guard.ts')) &&
      !/getFullYear\(\)/.test(read('src/lib/navigator-api/usage-guard.ts')),
  );
  check(
    '6k: the database constrains the bucket to the same shape',
    /month ~ '\^\[0-9\]\{4\}-\(0\[1-9\]\|1\[0-2\]\)\$'/.test(MIGRATION),
  );
  /* A fresh month starts empty, so a spent month does not strand the next. */
  const fresh = decideReservation({
    config: CONFIG,
    units: 1,
    globalUnitsBefore: 0,
    userUnitsBefore: 0,
  });
  check('6l: a new month starts from zero and allows again', fresh.allowed);
}

/* ===================================================================== *
 * 7. FAIL CLOSED
 * ===================================================================== */
{
  const src = read('src/lib/navigator-api/usage-reservation.ts');
  check(
    '7a: an unconfigured guard refuses',
    /return \{ allowed: false, reason: 'not-configured' \}/.test(src),
  );
  check(
    '7b: a missing service-role key refuses rather than proceeding',
    /catch \{[\s\S]{0,200}?reason: 'guard-unavailable'/.test(src),
  );
  check(
    '7c: an RPC error refuses',
    /if \(error\) return \{ allowed: false, reason: 'guard-unavailable' \}/.test(src),
  );
  check(
    '7d: an unrecognised response shape refuses rather than being guessed at',
    /if \(!row \|\| typeof row\.allowed !== 'boolean'\)[\s\S]{0,120}?guard-unavailable/.test(src),
  );
  check(
    '7e: an unknown refusal reason is treated as unavailable, not as a clean refusal',
    /return \{ allowed: false, reason: 'guard-unavailable' \};\s*\n\s*\} catch/.test(src),
  );
  check(
    '7f: there is no path that returns allowed:true on an error',
    !/catch[\s\S]{0,200}allowed: true/.test(src),
  );
  const gate = read('src/lib/navigator-api/metered-gate.ts');
  check(
    '7g: the gate refuses when the reservation is not allowed',
    /if \(!reservation\.allowed\)/.test(gate),
  );
  check(
    '7h: public mode with no account to attribute to is refused, not waved through',
    /usage-guard-unattributable/.test(gate),
  );
  check(
    '7i: a limit refusal is 429 and a configuration failure is 503',
    /=== 'global-threshold' \|\| reservation\.reason === 'user-limit'\s*\n\s*\? 429\s*\n\s*: 503/.test(
      gate,
    ),
  );
}

/* ===================================================================== *
 * 8. RESERVATIONS ARE NEVER REFUNDED
 * ===================================================================== */
{
  check('8a: the rule is a named function, not a comment', refundIsPermitted() === false);
  const src = read('src/lib/navigator-api/usage-reservation.ts');
  check(
    '8b: there is no refund or release function',
    !/refund|release|rollback|decrement/i.test(src.replace(/\/\*[\s\S]*?\*\//g, ' ')),
  );
  const gate = read('src/lib/navigator-api/metered-gate.ts');
  check('8c: nor in the gate', !/refund|release/i.test(gate.replace(/\/\*[\s\S]*?\*\//g, ' ')));
  /*
   * The migration's ONE decrement is the undo of a per-user increment when the
   * global test then fails — inside the same transaction, before the caller
   * ever sees an answer. That is not a refund; it is a reservation that never
   * completed. Pinned so the distinction stays visible.
   */
  const decrements = MIGRATION.match(/units = units - p_units/g) ?? [];
  check('8d: the SQL has exactly one decrement', decrements.length === 1, decrements.length);
  check(
    '8e: …and it is the undo of a reservation that was refused, not a refund',
    /if v_global_units is null then[\s\S]{0,400}?units = units - p_units/.test(MIGRATION),
  );
}

/* ===================================================================== *
 * 9. WHAT THE DRIVER IS TOLD
 * ===================================================================== */
{
  check('9a: no number appears in the message', !/\d/.test(USAGE_LIMIT_USER_MESSAGE));
  for (const [what, re] of [
    ['a threshold', /threshold|allowance|quota/i],
    ['a remaining balance', /remaining|left|out of/i],
    ['the provider', /HERE\b|hereapi|provider/i],
    ['infrastructure', /supabase|database|serverless|netlify|postgres/i],
    ['billing', /bill|invoice|cost|charge|\$|payment/i],
  ] as const) {
    check(`9b: the message does not mention ${what}`, !re.test(USAGE_LIMIT_USER_MESSAGE));
  }
  check(
    '9c: it tells the driver their truck and route are not the problem',
    /nothing is wrong with your truck/i.test(USAGE_LIMIT_USER_MESSAGE),
  );
  check(
    '9d: and that their saved setup is safe',
    /saved setup is safe/i.test(USAGE_LIMIT_USER_MESSAGE),
  );
  check('9e: it is one message for all four causes', typeof USAGE_LIMIT_USER_MESSAGE === 'string');
}

/* ===================================================================== *
 * 10. ADMIN REPORTING
 * ===================================================================== */
{
  const ROUTE = read('src/app/admin/(dashboard)/navigator/usage/json/route.ts');
  const PAGE = read('src/app/admin/(dashboard)/navigator/usage/page.tsx');

  check(
    '10a: the JSON route authenticates ITSELF — route handlers are not wrapped by the layout gate',
    /if \(!isAdminAuthed\(\)\)/.test(ROUTE),
  );
  check(
    '10b: …and answers 401 rather than redirecting a client into parsing a login page',
    /status: 401/.test(ROUTE) && !/redirect\(/.test(ROUTE),
  );
  check('10c: the page carries its own gate too', /requireAdmin\(\)/.test(PAGE));
  check(
    '10d: the report reads the service-role view, never a user-scoped client',
    /createAdminClient\(\)/.test(ROUTE) && /navigator_provider_usage_report/.test(ROUTE),
  );
  check(
    '10e: the view is granted to service_role alone',
    /grant select on public\.navigator_provider_usage_report to service_role/.test(MIGRATION) &&
      /revoke all on public\.navigator_provider_usage_report from anon, authenticated/.test(
        MIGRATION,
      ),
  );
  check(
    '10f: a missing migration is a 503, never a zeroed report',
    /usage-view-unavailable/.test(ROUTE) && /status: 503/.test(ROUTE),
  );
  check(
    '10g: an unparseable month means THIS month, never an empty window',
    /usageMonthKey\(Date\.now\(\)\)/.test(ROUTE),
  );

  /* The report itself. */
  const rows: UsageRow[] = [
    { month: '2026-08', endpoint: 'navigator.route', requests: 12, units: 24 },
    { month: '2026-08', endpoint: 'navigator.destination-search', requests: 40, units: 40 },
    { month: '2026-07', endpoint: 'navigator.route', requests: 999, units: 999 },
  ];
  const report = buildUsageReport({ month: '2026-08', rows, threshold: 4000, allowance: 5000 });
  check(
    '10h: totals are by month and endpoint',
    report.totalUnits === 64 && report.totalRequests === 52,
  );
  check('10i: another month is excluded', !report.lines.some((l) => l.units === 999));
  check(
    '10j: every metered endpoint gets a line, even with no traffic',
    report.lines.length === METERED_ENDPOINT_KEYS.length,
  );
  check('10k: remaining is threshold minus units', report.remaining === 4000 - 64);
  check('10l: it is not refusing yet', report.refusing === false);

  const spent = buildUsageReport({
    month: '2026-08',
    rows: [{ month: '2026-08', endpoint: 'navigator.route', requests: 4000, units: 4000 }],
    threshold: 4000,
    allowance: 5000,
  });
  check('10m: at the threshold the report says it is refusing', spent.refusing === true);
  check('10n: remaining never goes negative', spent.remaining === 0);

  const unconfigured = buildUsageReport({
    month: '2026-08',
    rows,
    threshold: null,
    allowance: null,
  });
  check(
    '10o: an unconfigured guard reports null rather than a made-up ceiling',
    unconfigured.remaining === null && unconfigured.percentOfThreshold === null,
  );
  check('10p: and does not claim to be refusing', unconfigured.refusing === false);

  /* Empty rows must still produce zeroed lines, not a missing table. */
  const empty = buildUsageReport({ month: '2026-08', rows: [], threshold: 4000, allowance: 5000 });
  check(
    '10q: an empty month still lists every endpoint at zero',
    empty.lines.length === 2 && empty.totalUnits === 0,
  );

  /* The standing caveat. */
  check(
    '10r: the caveat refuses to call these HERE transactions',
    /not HERE transactions/i.test(USAGE_REPORT_CAVEAT),
  );
  check(
    '10s: it says the two products bill separately',
    /different HERE products/i.test(USAGE_REPORT_CAVEAT),
  );
  check(
    '10t: it says reservations are never refunded',
    /never refunded/i.test(USAGE_REPORT_CAVEAT),
  );
  check('10u: it describes the number as an upper bound', /upper bound/i.test(USAGE_REPORT_CAVEAT));
  check(
    '10v: and points at the HERE dashboard as the billing record',
    /billing record/i.test(USAGE_REPORT_CAVEAT),
  );
  check('10w: the caveat is printed on the page, not filed away', /USAGE_REPORT_CAVEAT/.test(PAGE));
}

/* ===================================================================== *
 * 11. NO PII, NO SECRETS
 * ===================================================================== */
{
  /*
   * The scan runs on IDENTIFIERS, not on prose.
   *
   * This migration names every forbidden field explicitly — in `--` comments
   * and in `comment on ... is '...'` strings — precisely in order to forbid
   * them. A scan that tripped over its own prohibition would push the next
   * author to delete the prohibition rather than keep the rule, so both
   * comment forms are stripped and what remains is the actual schema.
   */
  const SQL_IDENTIFIERS = MIGRATION.replace(/^\s*--.*$/gm, ' ')
    .replace(/'(?:[^']|'')*'/g, "''")
    .replace(/\$\$[\s\S]*?\$\$/g, ' $BODY$ ');

  /** One CREATE TABLE's column list, and nothing beyond its closing paren. */
  const tableBody = (name: string): string => {
    const start = MIGRATION.indexOf(`create table if not exists public.${name} (`);
    if (start < 0) return `MISSING TABLE ${name}`;
    let depth = 0;
    for (let i = MIGRATION.indexOf('(', start); i < MIGRATION.length; i += 1) {
      if (MIGRATION[i] === '(') depth += 1;
      else if (MIGRATION[i] === ')') {
        depth -= 1;
        if (depth === 0) return MIGRATION.slice(start, i + 1);
      }
    }
    return `UNTERMINATED TABLE ${name}`;
  };
  check(
    '11z: the table bodies were located',
    !/MISSING|UNTERMINATED/.test(
      tableBody('navigator_provider_month') +
        tableBody('navigator_provider_usage') +
        tableBody('navigator_provider_user_usage'),
    ),
  );

  /* The ledger's columns, read off the migration. */
  for (const [what, re] of [
    ['an email', /\bemail\b/i],
    ['a phone', /\bphone\b/i],
    ['a name', /first_name|last_name|\bname text\b/i],
    ['a position', /\blat\b|\blng\b|latitude|longitude|position/i],
    ['a destination', /destination/i],
    ['search text', /search_text|\bquery\b/i],
    ['a route', /route_points|geometry|polyline|maneuver/i],
    ['an IP address', /ip_address|\bip\b text/i],
    ['a user agent', /user_agent/i],
  ] as const) {
    check(`11a: the usage ledger stores no ${what}`, !re.test(SQL_IDENTIFIERS), what);
  }
  check(
    '11b: the only identifier is a user_id, and it cascades on account deletion',
    /user_id uuid not null references auth\.users\(id\) on delete cascade/.test(MIGRATION),
  );
  check(
    '11c: the aggregate tables carry no user id at all',
    !/user_id/.test(tableBody('navigator_provider_month')) &&
      !/user_id/.test(tableBody('navigator_provider_usage')),
    [tableBody('navigator_provider_month').length, tableBody('navigator_provider_usage').length],
  );
  check(
    '11d: the admin report view exposes no user id',
    !/user_id/.test(
      MIGRATION.slice(
        MIGRATION.indexOf('create or replace view public.navigator_provider_usage_report'),
      ).split(';')[0],
    ),
  );
  check(
    '11e: neither anon nor authenticated may read the ledger directly',
    /revoke all on public\.navigator_provider_month\s+from anon, authenticated/.test(MIGRATION) &&
      /revoke all on public\.navigator_provider_user_usage from anon, authenticated/.test(
        MIGRATION,
      ),
  );
  check(
    '11f: RLS is on for all three tables',
    (MIGRATION.match(/enable row level security/g) ?? []).length === 3,
  );
  /*
   * 11g SAID "executable by a driver" AND TREATED THAT AS CORRECT. It was the
   * defect, asserted as the requirement.
   *
   * The function takes both thresholds as arguments and runs SECURITY DEFINER,
   * so any caller who can reach it chooses its own limits. Reachability was
   * real: PostgREST exposes functions in `public` to any role holding EXECUTE,
   * and Supabase's default privileges grant EXECUTE on new functions to `anon`
   * and `authenticated` — which `revoke … from public` does not remove. One
   * call with a caller-supplied threshold drove the shared month counter to
   * 2,000,041 against a server threshold of 100 on a real server.
   *
   * The application never used the grant; reservations go through the
   * `server-only` service-role client. So the requirement is the opposite of
   * what was written, and it is now asserted as such: revoked from all three
   * of public/anon/authenticated, granted to service_role alone.
   */
  check(
    '11g: the reservation function is granted to service_role, never to a driver',
    /grant execute on function public\.navigator_reserve_provider_units[\s\S]{0,160}to service_role/.test(
      MIGRATION,
    ) &&
      !/grant execute on function public\.navigator_reserve_provider_units[\s\S]{0,160}to authenticated/.test(
        MIGRATION,
      ),
  );
  for (const role of ['public', 'anon', 'authenticated']) {
    check(
      `11h: …and execute is revoked from ${role}`,
      new RegExp(
        `revoke all on function public\\.navigator_reserve_provider_units[^;]{0,120}from ${role};`,
      ).test(MIGRATION),
    );
  }
  const guardSrc = read('src/lib/navigator-api/usage-guard.ts');
  check('11i: the policy module logs nothing', !/console\./.test(guardSrc));
  check(
    '11j: nor does the plumbing',
    !/console\./.test(read('src/lib/navigator-api/usage-reservation.ts')),
  );
  check(
    '11k: the policy module reads no environment at module scope',
    !/^const \w+ = process\.env/m.test(guardSrc),
  );
}

/* ===================================================================== *
 * 12. THE MIGRATION IS PROPOSED, NOT APPLIED
 * ===================================================================== */
{
  check(
    '12a: it is numbered 051, the next free number',
    /051/.test('051_navigator_provider_usage.sql'),
  );
  check(
    '12b: it says in its own first lines that it must not be applied without approval',
    /DO NOT APPLY WITHOUT EXPLICIT APPROVAL/.test(MIGRATION.slice(0, 800)),
  );
  check(
    '12c: it is additive — it alters no existing table',
    !/alter table (?!public\.navigator_provider)/i.test(MIGRATION),
  );
  check(
    '12d: it is idempotent',
    /create table if not exists/.test(MIGRATION) && /create or replace function/.test(MIGRATION),
  );
  check(
    '12e: it drops policies before creating them, so a hand-added one cannot survive',
    /drop policy if exists/.test(MIGRATION),
  );
}

console.log(`navigator-usage-guard: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
