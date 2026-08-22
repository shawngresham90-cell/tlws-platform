/**
 * Migration 057 against a real Postgres, in a transaction that always rolls
 * back.
 *
 * WHAT THIS EXISTS TO PROVE
 *
 * `npm test` is hermetic. Everything it can establish about 057 it establishes
 * by reading the file: that the CHECK contains no `now()`, that the
 * post-conditions exist, that nothing writes a data value. Four things it
 * cannot establish that way, and they are the four that decide whether the
 * owner's apply goes cleanly:
 *
 *   1. that the SQL executes at all on a real server;
 *   2. that the drift guard actually fires on a database that already has the
 *      column, rather than merely being written as though it would;
 *   3. that the CHECK actually refuses a featured row with no term, and
 *      actually permits one with a term — the constraint text is easy to get
 *      backwards and a `not ... or ...` reads wrong to most people;
 *   4. that the post-conditions actually pass on THIS database's data.
 *
 * IT WRITES NOTHING. EVER.
 *
 * Every probe runs inside `begin; … rollback;`, and the rollback is not
 * conditional on the probe succeeding — `ON_ERROR_STOP` is set and each probe
 * is its own psql invocation, so a failure aborts that transaction and the
 * server discards it. There is no code path in this file that issues a commit.
 * DDL in Postgres is transactional, so even the column creation is undone.
 *
 * IT REFUSES TO POINT AT PRODUCTION UNLESS TOLD TO, EXPLICITLY
 *
 * By default a production project ref in the URL is refused outright. The
 * owner can override that with FEATURED_TERM_VERIFY_ALLOW_PRODUCTION=1, and
 * that is deliberate: the whole value of a rollback-only rehearsal is that it
 * can be run against the database the migration will actually be applied to.
 * A rehearsal on a different database proves the SQL parses, not that it fits.
 * The override is a separate, typed act — never a default, never inferred.
 *
 * IT SKIPS CLEANLY, AND THAT IS THE POINT
 *
 * No URL, no `psql`, or a server that will not answer: it says why and exits
 * 0 with the word SKIPPED. Absent evidence is reported as absent, never as
 * passing. A check that fails when its optional environment is missing is a
 * check everybody learns to ignore.
 *
 * Usage:
 *   FEATURED_TERM_VERIFY_DB_URL='postgresql://…' node scripts/verify-featured-term-migration.mjs
 *
 *   # rehearse against the database 057 will really be applied to:
 *   FEATURED_TERM_VERIFY_ALLOW_PRODUCTION=1 \
 *   FEATURED_TERM_VERIFY_DB_URL='postgresql://…' node scripts/verify-featured-term-migration.mjs
 *
 * No credential is read from anywhere but the environment, none is printed,
 * and the URL itself is never echoed.
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const URL_VARS = ['FEATURED_TERM_VERIFY_DB_URL', 'SUPABASE_TEST_DB_URL'];
const MIGRATION = 'supabase/migrations/057_featured_listing_term.sql';

/** Known project refs. Refused unless the operator opts in explicitly. */
const PRODUCTION_REFS = [
  'cgvxwvymkembftznhcdl', // tlws-platform — PRODUCTION
  'jgzcwkorjxhbqzdzxwzt', // TruckLifePWA
  'kasbuwnrfoepodjzfiwc', // cdl-preschool
  'mmnvcbejjdweetnxncfi', // ShopScheduler
  'bvmeplpthztjqreqpwcf', // RosedaleIdle
  'avsxobudpojweuikaala', // crewcut-os
  'omylhjhvdxbjsaxfqthm', // TRUCKING-LIFE-PWA-HUFFYONLY
];

let passed = 0;
let failed = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) {
    console.log(`ok   ${name}`);
    passed += 1;
  } else {
    failed += 1;
    failures.push(name);
    console.log(`FAIL ${name}${detail === undefined ? '' : ` — ${String(detail).slice(0, 300)}`}`);
  }
}
function skip(reason) {
  console.log(`\nSKIPPED: 057 verification — ${reason}`);
  console.log('This is NOT a pass. The live evidence was not collected.');
  console.log(`Set ${URL_VARS[0]} to run it. Every probe rolls back; nothing is written.`);
  process.exit(0);
}

/* ------------------------------------------------------------ preflight */

const url = URL_VARS.map((v) => process.env[v]).find((v) => v && v.trim().length > 0);
if (!url) skip(`neither ${URL_VARS.join(' nor ')} is set`);
if (!existsSync(MIGRATION)) skip(`migration file missing: ${MIGRATION}`);
if (spawnSync('psql', ['--version'], { encoding: 'utf8' }).status !== 0)
  skip('psql is not installed or not on PATH');

/**
 * The production rail, BEFORE any connection is opened.
 *
 * Order matters and the reason is not pedantry: probing first would mean
 * opening a session against a database to ask its version before deciding
 * whether we were allowed to talk to it. "It was only a SELECT" is not a
 * defence, it is a connection.
 */
const ALLOW_PRODUCTION = process.env.FEATURED_TERM_VERIFY_ALLOW_PRODUCTION === '1';
const namedRef = PRODUCTION_REFS.find((ref) => url.toLowerCase().includes(ref));
if (namedRef && !ALLOW_PRODUCTION) {
  console.error(
    `\nREFUSED: the connection URL names project ref ${namedRef}.\n` +
      'Every probe in this file rolls back, but pointing it at a live database is\n' +
      'still an operator decision and not a default. Re-run with\n' +
      '  FEATURED_TERM_VERIFY_ALLOW_PRODUCTION=1\n' +
      'if that is what you intend. No connection was opened.',
  );
  process.exit(1);
}

/* ------------------------------------------------------------ psql plumbing */

/**
 * Run a script in ONE psql invocation with ON_ERROR_STOP.
 *
 * `expectFailure` inverts the contract: the probe is asserting that the server
 * REFUSES something, so a non-zero exit is the pass and the message is the
 * evidence.
 */
function run(script, { expectFailure = false } = {}) {
  const res = spawnSync('psql', ['-v', 'ON_ERROR_STOP=1', '-X', '-tA', '-d', url, '-f', '-'], {
    input: `\\set ON_ERROR_STOP on\n${script}`,
    encoding: 'utf8',
  });
  const out = (res.stdout ?? '').trim();
  const err = (res.stderr ?? '').trim();
  if (expectFailure) return { refused: res.status !== 0, out, err };
  if (res.status !== 0) throw new Error(err || out || 'psql failed');
  return { refused: false, out, err };
}

/**
 * Wrap a probe so the server discards it whatever happens.
 *
 * The rollback is the LAST statement of the same script, and every script is
 * its own psql process, so an aborted transaction is discarded by the server
 * when the connection closes even if the rollback line is never reached.
 * Nothing in this file issues a commit.
 */
const inRollback = (body) => `begin;\n${body}\nrollback;`;

const migrationSql = readFileSync(MIGRATION, 'utf8');
/** The migration with its own transaction control stripped, to nest it. */
const migrationBody = migrationSql
  .split('\n')
  .filter((l) => !/^\s*(begin|commit)\s*;\s*$/i.test(l))
  .join('\n');

let serverVersion;
try {
  serverVersion = run('select version();').out.split('\n').filter(Boolean).pop() ?? '';
} catch (e) {
  skip(`the database did not answer (${String(e.message).split('\n')[0]})`);
}

console.log('\nmigration 057 — featured listing term');
console.log(`  server : ${serverVersion.split(',')[0]}`);
console.log(
  `  target : ${namedRef ? `project ${namedRef} (operator-approved)` : 'unnamed database'}`,
);
console.log('  writes : none — every probe rolls back\n');

/* ------------------------------------------------------------ preconditions */

{
  const before = run(`select
      (select count(*) from information_schema.columns
        where table_schema='public' and table_name='locations' and column_name='featured_until'),
      (select count(*) from public.locations where is_featured = true);`).out;
  const [colCount, featuredCount] = before.split('|').map((n) => Number(n.trim()));
  check('the term column is not present yet', colCount === 0, `found ${colCount}`);
  // The migration's own post-condition insists on this, so a surprise here is
  // better found now than halfway through an apply.
  check(
    'no row is currently featured, so the CHECK validates without a rewrite',
    featuredCount === 0,
    `${featuredCount} featured row(s) — reconcile before applying`,
  );
}

/* ------------------------------------------------------------ the migration */

{
  let ok = true;
  let detail = '';
  try {
    run(inRollback(migrationBody));
  } catch (e) {
    ok = false;
    detail = String(e.message).split('\n').slice(0, 3).join(' ');
  }
  check('the migration runs to completion, post-conditions included', ok, detail);
}

// And it left nothing behind.
{
  const after = run(
    `select count(*) from information_schema.columns
       where table_schema='public' and table_name='locations' and column_name='featured_until';`,
  ).out;
  check('the rollback left no column behind', Number(after) === 0, after);
}

/* ------------------------------------------------------------ the drift guard */

{
  // Apply it twice inside one rolled-back transaction. The second must abort.
  const twice = run(inRollback(`${migrationBody}\n${migrationBody}`), { expectFailure: true });
  check('applying it twice is refused by the drift guard', twice.refused, twice.err.slice(0, 200));
  check(
    'and the refusal says why, in the words the operator will see',
    /schema drift/i.test(twice.err),
    twice.err.slice(0, 200),
  );
}

/* ------------------------------------------------------------ the CHECK */

// `check (not is_featured or featured_until is not null)` reads backwards to
// most people. These two probes are the ones that would catch it inverted.
{
  const noTerm = run(
    inRollback(
      `${migrationBody}
       update public.locations set is_featured = true, featured_until = null
         where id = (select id from public.locations limit 1);`,
    ),
    { expectFailure: true },
  );
  check('a featured row with NO term is refused by the constraint', noTerm.refused);
  check(
    'and it is refused by name, not by some unrelated error',
    /locations_featured_term_check/.test(noTerm.err),
    noTerm.err.slice(0, 200),
  );
}

{
  let ok = true;
  let detail = '';
  try {
    run(
      inRollback(
        `${migrationBody}
         update public.locations
            set is_featured = true, featured_until = now() + interval '30 days'
          where id = (select id from public.locations limit 1);`,
      ),
    );
  } catch (e) {
    ok = false;
    detail = String(e.message).split('\n').slice(0, 2).join(' ');
  }
  check('a featured row WITH a term is permitted', ok, detail);
}

// A term in the PAST must also be permitted. Expiry is a read-time question,
// and a constraint that rejected a lapsed term would make renewal impossible
// and would start rejecting unrelated updates to old rows.
{
  let ok = true;
  let detail = '';
  try {
    run(
      inRollback(
        `${migrationBody}
         update public.locations
            set is_featured = true, featured_until = now() - interval '1 day'
          where id = (select id from public.locations limit 1);`,
      ),
    );
  } catch (e) {
    ok = false;
    detail = String(e.message).split('\n').slice(0, 2).join(' ');
  }
  check('a term already in the past is permitted — expiry is a read rule', ok, detail);
}

/* ------------------------------------------------------------ the index */

{
  const idx = run(
    inRollback(
      `${migrationBody}
       select indexdef from pg_indexes
        where schemaname='public' and indexname='locations_featured_active_idx';`,
    ),
  ).out;
  check(
    'the partial index is created',
    /locations_featured_active_idx/.test(idx),
    idx.slice(0, 200),
  );
  check(
    'the index predicate does not consult the clock',
    idx.length > 0 && !/now\(\)|current_timestamp/i.test(idx),
    idx.slice(0, 200),
  );
}

/* ------------------------------------------------------------ nothing written */

{
  const stillAbsent = run(
    `select
       (select count(*) from information_schema.columns
         where table_schema='public' and table_name='locations' and column_name='featured_until'),
       (select count(*) from public.locations where is_featured = true);`,
  ).out;
  const [colCount, featuredCount] = stillAbsent.split('|').map((n) => Number(n.trim()));
  check('after every probe the column is still absent', colCount === 0, colCount);
  check('after every probe no row became featured', featuredCount === 0, featuredCount);
}

console.log(`\n057 verification: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  console.log(`failed: ${failures.join(', ')}`);
  process.exit(1);
}
console.log('The database is ready for migration 057. Nothing was written.');
