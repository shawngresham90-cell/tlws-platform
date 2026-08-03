/**
 * Execute migration 049 against a throwaway Postgres and assert what it does.
 *
 * WHY THIS IS NOT `scripts/test-*.ts`. Those harnesses are offline by contract
 * — no network, no database — and `run-tests.mjs` picks up every one of them,
 * so a harness needing a server would fail CI on every machine without one.
 * This is run deliberately, by hand, before anyone applies 049.
 *
 * WHY IT EXISTS AT ALL. The offline harness can only assert that the migration
 * FILE contains certain text. That catches a deleted `revoke`; it cannot catch
 * a view whose latest-wins logic resolves a tie the wrong way, a check
 * constraint that admits what it should reject, or a `security_invoker` view
 * that quietly reads past RLS. Those are the failures that would matter, and
 * the only way to see them is to run the SQL.
 *
 * SAFETY. It refuses any host that is not a local socket or loopback, then
 * CREATEs its own uniquely-named scratch database and DROPs it at the end. It
 * never applies anything to a database it did not create. Production Supabase
 * is unreachable from here by construction, not by carefulness.
 *
 *   # start a throwaway cluster, then:
 *   node scripts/verify-migration-049.mjs --host /path/to/socket
 *   node scripts/verify-migration-049.mjs --host 127.0.0.1 --port 5432
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

const host = arg('host', process.env.PGHOST ?? '/var/run/postgresql');
const port = arg('port', process.env.PGPORT ?? '5432');
const user = arg('user', process.env.PGUSER ?? 'postgres');

// A socket path, localhost, or a loopback literal. Anything else — a hostname,
// a Supabase URL, a private IP — is refused rather than probed.
const isLocal =
  host.startsWith('/') || host === 'localhost' || host === '127.0.0.1' || host === '::1';
if (!isLocal) {
  console.error(`REFUSED: --host ${host} is not a local socket or loopback address.`);
  console.error(
    'This script CREATEs and DROPs a database. It runs against throwaway clusters only.',
  );
  process.exit(2);
}

const MIGRATION = 'supabase/migrations/049_email_consents.sql';
const db = `mig049_verify_${process.pid}`;
const work = mkdtempSync(join(tmpdir(), 'mig049-'));

function psql(sql, { db: target = db, expectFail = false } = {}) {
  const file = join(work, 'q.sql');
  writeFileSync(file, sql);
  try {
    const out = execFileSync(
      'psql',
      [
        '-h',
        host,
        '-p',
        port,
        '-U',
        user,
        '-d',
        target,
        '-tA',
        '-v',
        'ON_ERROR_STOP=1',
        '-f',
        file,
      ],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
    return { ok: true, out: out.trim() };
  } catch (e) {
    if (!expectFail) throw e;
    return { ok: false, out: String(e.stderr ?? e.message).trim() };
  }
}

let passed = 0;
const failures = [];
function check(name, cond, detail) {
  if (cond) passed++;
  else failures.push(`${name}${detail === undefined ? '' : ` — got ${JSON.stringify(detail)}`}`);
}
/** The statement must be rejected. A statement that succeeds here is the bug. */
function refuses(name, sql) {
  const r = psql(sql, { expectFail: true });
  check(name, !r.ok, r.ok ? 'ACCEPTED' : undefined);
}

// ── set up ───────────────────────────────────────────────────────────────
execFileSync(
  'psql',
  ['-h', host, '-p', port, '-U', user, '-d', 'postgres', '-q', '-c', `create database ${db}`],
  {
    stdio: 'pipe',
  },
);

try {
  psql(`
    do $$ begin
      if not exists (select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
      if not exists (select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
      if not exists (select 1 from pg_roles where rolname='mig049_probe') then create role mig049_probe nologin; end if;
    end $$;
  `);

  const sql = readFileSync(MIGRATION, 'utf8');
  psql(sql);
  check('migration applies', true);
  psql(sql);
  check('migration is idempotent on re-apply', true);

  // ── derived status: latest instruction wins ────────────────────────────
  psql(`
    insert into public.email_consents (source_form, source_url, email, email_consent, email_consent_at, email_consent_version, disclosure_text, created_at) values
      ('newsletter','/','plain@x.com',        true,  '2026-01-01T00:00:00Z','v1','wording','2026-01-01T00:00:00Z'),
      ('newsletter','/','left@x.com',         true,  '2026-01-01T00:00:00Z','v1','wording','2026-01-01T00:00:00Z'),
      ('newsletter','/','rejoined@x.com',     true,  '2026-01-01T00:00:00Z','v1','wording','2026-01-01T00:00:00Z'),
      ('newsletter','/','rejoined@x.com',     true,  '2026-03-01T00:00:00Z','v1','wording','2026-03-01T00:00:00Z'),
      ('newsletter','/','declined@x.com',     false, null,                  'v1','wording','2026-01-01T00:00:00Z'),
      ('newsletter','/','tie@x.com',          true,  '2026-02-01T00:00:00Z','v1','wording','2026-02-01T00:00:00Z'),
      ('newsletter','/','laterdecline@x.com', true,  '2026-01-01T00:00:00Z','v1','wording','2026-01-01T00:00:00Z'),
      ('newsletter','/','laterdecline@x.com', false, null,                  'v1','wording','2026-02-01T00:00:00Z');
    insert into public.email_unsubscribes (email, method, created_at) values
      ('left@x.com',       'link',      '2026-02-01T00:00:00Z'),
      ('rejoined@x.com',   'link',      '2026-02-01T00:00:00Z'),
      ('tie@x.com',        'one-click', '2026-02-01T00:00:00Z'),
      ('neverjoined@x.com','complaint', '2026-02-01T00:00:00Z');
  `);

  const status = Object.fromEntries(
    psql(
      `select email || '=' || is_subscribed || ':' || status from public.email_subscription_status order by email;`,
    )
      .out.split('\n')
      .map((line) => {
        const [email, rest] = line.split('=');
        return [email, rest];
      }),
  );

  const expected = {
    'plain@x.com': 'true:subscribed',
    'left@x.com': 'false:unsubscribed',
    // Signed up, left, signed up again — the newest instruction is the current one.
    'rejoined@x.com': 'true:subscribed',
    'declined@x.com': 'false:declined',
    // An opt-out with no prior consent is still an opt-out.
    'neverjoined@x.com': 'false:unsubscribed',
    // Same instant on both sides. The tiebreak must not send.
    'tie@x.com': 'false:unsubscribed',
    // A later decline outranks an earlier opt-in without any unsubscribe row.
    'laterdecline@x.com': 'false:declined',
  };
  for (const [email, want] of Object.entries(expected)) {
    check(`status ${email} is ${want}`, status[email] === want, status[email]);
  }

  check(
    'an address with no evidence is absent from the view, not defaulted to subscribed',
    psql(`select count(*) from public.email_subscription_status where email='noevidence@x.com';`)
      .out === '0',
  );

  // ── constraints ────────────────────────────────────────────────────────
  const consent = (cols, vals) =>
    `insert into public.email_consents (source_form,source_url,${cols}) values ('newsletter','/',${vals});`;
  refuses(
    'rejects an uppercase consent email',
    consent(
      'email,email_consent,email_consent_version,disclosure_text',
      `'UPPER@x.com',false,'v1','w'`,
    ),
  );
  refuses(
    'rejects an untrimmed consent email',
    consent(
      'email,email_consent,email_consent_version,disclosure_text',
      `' a@x.com',false,'v1','w'`,
    ),
  );
  refuses(
    'rejects blank disclosure wording',
    consent(
      'email,email_consent,email_consent_version,disclosure_text',
      `'a@x.com',false,'v1','   '`,
    ),
  );
  refuses(
    'rejects a blank disclosure version',
    consent(
      'email,email_consent,email_consent_version,disclosure_text',
      `'a@x.com',false,'  ','w'`,
    ),
  );
  refuses(
    'rejects a consent timestamp on a decline',
    consent(
      'email,email_consent,email_consent_at,email_consent_version,disclosure_text',
      `'a@x.com',false,now(),'v1','w'`,
    ),
  );
  refuses(
    'rejects an unknown unsubscribe method',
    `insert into public.email_unsubscribes (email,method) values ('a@x.com','carrier-pigeon');`,
  );
  refuses(
    'rejects an uppercase unsubscribe email',
    `insert into public.email_unsubscribes (email,method) values ('A@x.com','link');`,
  );

  // The method allowlist in TypeScript must match the one in SQL, or a value
  // the app considers valid is rejected by the database at insert time.
  const tsMethods = [
    ...readFileSync('src/lib/leads/email-consent.ts', 'utf8').matchAll(/'([a-z-]+)'/g),
  ]
    .map((m) => m[1])
    .filter((v) => ['link', 'one-click', 'reply', 'complaint', 'manual'].includes(v));
  for (const method of new Set(tsMethods)) {
    const r = psql(
      `insert into public.email_unsubscribes (email,method) values ('allowlist@x.com','${method}');`,
      {
        expectFail: true,
      },
    );
    check(`SQL accepts the TypeScript method "${method}"`, r.ok, r.out.split('\n')[0]);
  }

  // ── idempotency tokens ─────────────────────────────────────────────────
  psql(
    `insert into public.email_unsubscribes (email,method,submission_id) values ('tok@x.com','link','tok-1');`,
  );
  refuses(
    'a replayed submission_id cannot stack a second row',
    `insert into public.email_unsubscribes (email,method,submission_id) values ('tok@x.com','link','tok-1');`,
  );
  psql(`insert into public.email_unsubscribes (email,method) values ('nul@x.com','link');
        insert into public.email_unsubscribes (email,method) values ('nul@x.com','link');`);
  check('tokenless rows still append freely', true);

  // ── append-only, by privilege ──────────────────────────────────────────
  for (const table of ['email_consents', 'email_unsubscribes']) {
    for (const verb of ['update', 'delete', 'truncate']) {
      const stmt =
        verb === 'update'
          ? `update public.${table} set email='tampered@x.com'`
          : verb === 'delete'
            ? `delete from public.${table}`
            : `truncate public.${table}`;
      refuses(
        `service_role cannot ${verb.toUpperCase()} ${table}`,
        `set role service_role; ${stmt};`,
      );
    }
  }
  check(
    'service_role can still INSERT consent evidence',
    psql(
      `set role service_role; ${consent('email,email_consent,email_consent_version,disclosure_text', `'sr@x.com',true,'v1','w'`)}`,
    ).ok,
  );

  // ── nobody else gets in ────────────────────────────────────────────────
  for (const role of ['anon', 'authenticated']) {
    for (const rel of ['email_consents', 'email_unsubscribes', 'email_subscription_status']) {
      refuses(
        `${role} cannot read ${rel}`,
        `set role ${role}; select count(*) from public.${rel};`,
      );
    }
  }

  // Granted the view and nothing else. With security_invoker=on this must fail
  // on the base tables; if the view ever reverts to definer semantics it would
  // succeed, and this is the assertion that would notice.
  psql(`grant select on public.email_subscription_status to mig049_probe;`);
  refuses(
    'the status view does not read past RLS for a role without base-table access',
    `set role mig049_probe; select count(*) from public.email_subscription_status;`,
  );
  check(
    'the status view declares security_invoker=on',
    psql(
      `select coalesce(array_to_string(reloptions,','),'') from pg_class where relname='email_subscription_status';`,
    ).out.includes('security_invoker=on'),
  );
  check(
    'RLS is enabled on both evidence tables',
    psql(
      `select count(*) from pg_class where relname in ('email_consents','email_unsubscribes') and relrowsecurity;`,
    ).out === '2',
  );

  // ── rollback, taken from the migration's own comment block ─────────────
  const rollback = sql
    .split('-- ROLLBACK')[1]
    .split('\n')
    .filter((l) => l.startsWith('--   '))
    .map((l) => l.slice(5))
    .join('\n');
  check(
    'a rollback block is present in the migration',
    rollback.includes('drop table if exists public.email_consents'),
  );
  refuses('the rollback guard refuses to drop tables holding evidence', rollback);

  execFileSync(
    'psql',
    [
      '-h',
      host,
      '-p',
      port,
      '-U',
      user,
      '-d',
      'postgres',
      '-q',
      '-c',
      `create database ${db}_empty`,
    ],
    {
      stdio: 'pipe',
    },
  );
  psql(sql, { db: `${db}_empty` });
  const dropped = psql(rollback, { db: `${db}_empty`, expectFail: true });
  check(
    'the rollback runs cleanly against an empty schema',
    dropped.ok,
    dropped.out.split('\n')[0],
  );
  check(
    'the rollback leaves no objects behind',
    psql(
      `select count(*) from pg_class where relname in ('email_consents','email_unsubscribes','email_subscription_status');`,
      { db: `${db}_empty` },
    ).out === '0',
  );
} finally {
  rmSync(work, { recursive: true, force: true });
  for (const target of [db, `${db}_empty`]) {
    try {
      execFileSync(
        'psql',
        [
          '-h',
          host,
          '-p',
          port,
          '-U',
          user,
          '-d',
          'postgres',
          '-q',
          '-c',
          `drop database if exists ${target}`,
        ],
        {
          stdio: 'pipe',
        },
      );
    } catch {
      console.error(`WARNING: could not drop scratch database ${target}`);
    }
  }
}

for (const f of failures) console.log(`FAIL: ${f}`);
console.log(`\nmigration 049: ${passed} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
