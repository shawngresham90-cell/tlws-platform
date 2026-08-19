/**
 * Supabase RLS / grant contract — the offline half of the 2026-08-18
 * security audit (docs/operations/supabase-rls-audit-2026-08-18.md).
 *
 * CI cannot reach the production database, so this harness enforces the
 * audit's conclusions where they are actually authored: the migration files
 * and the client code. The live catalog can still drift by hand, which is
 * what `scripts/verify-rls-live.sh` (owner-run) covers — but no PR can
 * reintroduce the classes of defect the audit found without failing here:
 *
 *   1. a table created without RLS ever being enabled on it;
 *   2. a write policy for anon, or a policy for a role that never gets one;
 *   3. a blanket `using (true)` policy outside the two known-public cases;
 *   4. a table write-grant to anon;
 *   5. the 054 lockdown itself being weakened or made non-idempotent;
 *   6. the service-role key leaking toward client code.
 *
 * Filesystem-only. No database, no network, CI-safe.
 *
 *   npx esbuild scripts/test-supabase-rls-contract.ts --bundle \
 *     --platform=node --format=cjs --alias:@=./src --outfile=/tmp/t.cjs && node /tmp/t.cjs
 */
import * as fs from 'node:fs';
import * as path from 'node:path';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const root = process.cwd();
const MIG_DIR = 'supabase/migrations';
const migFiles = fs
  .readdirSync(path.join(root, MIG_DIR))
  .filter((f) => f.endsWith('.sql'))
  .sort();
check('migration directory is populated', migFiles.length >= 54, migFiles.length);

/** SQL with comments stripped — rules must read shipped statements only. */
const sqlOf = new Map<string, string>();
for (const f of migFiles) {
  const raw = fs.readFileSync(path.join(root, MIG_DIR, f), 'utf8');
  sqlOf.set(
    f,
    raw
      .replace(/--[^\n]*/g, ' ')
      .replace(/\s+/g, ' ')
      .toLowerCase(),
  );
}
const allSql = [...sqlOf.values()].join('\n');

/* ── 1. every created table has RLS enabled somewhere ─────────────────── */

const created = new Set<string>();
for (const sql of sqlOf.values()) {
  for (const m of sql.matchAll(/create table (?:if not exists )?public\.([a-z_]+)/g)) {
    created.add(m[1]);
  }
}
check('the migrations create a substantial schema', created.size >= 30, created.size);
const missingRls = [...created].filter(
  (t) => !new RegExp(`alter table (?:only )?public\\.${t} enable row level security`).test(allSql),
);
check('every created table gets RLS enabled', missingRls.length === 0, missingRls);

/* ── 2. policy rules ──────────────────────────────────────────────────── */

type Policy = { file: string; table: string; cmd: string; roles: string[]; body: string };
const policies: Policy[] = [];
for (const [f, sql] of sqlOf) {
  for (const m of sql.matchAll(
    /create policy (?:"[^"]+"|[a-z0-9_]+) on (?:public\.)?([a-z_]+)((?:(?!create policy).)*?);/g,
  )) {
    const table = m[1];
    const rest = m[2];
    const cmd = rest.match(/ for (select|insert|update|delete|all)/)?.[1] ?? 'all';
    const to = rest.match(/ to ([a-z_, ]+?)(?: using| with check|$)/)?.[1];
    const roles = to ? to.split(',').map((s) => s.trim()) : ['public'];
    policies.push({ file: f, table, cmd, roles, body: rest });
  }
}
check('the policy parser found the policy set', policies.length >= 20, policies.length);

// 2a. anon (or default-PUBLIC) never receives a write policy.
const anonWrite = policies.filter(
  (p) => p.cmd !== 'select' && p.roles.some((r) => r === 'anon' || r === 'public'),
);
check('no write policy is granted to anon/public', anonWrite.length === 0, anonWrite);

// 2b. authenticated write policies stay on the deliberate user-owned set.
const AUTH_WRITE_OK = new Set([
  'saved_trips',
  'truck_presets',
  'admin_users',
  'navigator_profiles',
  'navigator_state',
]);
const badAuthWrite = policies.filter(
  (p) => p.cmd !== 'select' && p.roles.includes('authenticated') && !AUTH_WRITE_OK.has(p.table),
);
check(
  'authenticated write policies only on user-owned tables',
  badAuthWrite.length === 0,
  badAuthWrite,
);

// 2c. blanket `using (true)` only on the two known-public SELECT cases.
const TRUE_OK = new Set(['campaign_settings', 'directory_slug_redirects']);
const blanket = policies.filter(
  (p) => /using \(?\s*true\s*\)?/.test(p.body) && !(p.cmd === 'select' && TRUE_OK.has(p.table)),
);
check('no blanket using(true) outside the public allowlist', blanket.length === 0, blanket);
const blanketCheck = policies.filter((p) => /with check \(?\s*true\s*\)?/.test(p.body));
check('no policy ships a blanket with check (true)', blanketCheck.length === 0, blanketCheck);

// 2d. sensitive tables never receive an anon/public policy of ANY kind.
const SENSITIVE = [
  'applications',
  'application_events',
  'leads',
  'sms_consents',
  'email_consents',
  'email_unsubscribes',
  'location_submissions',
  'community_profiles',
  'location_history',
  'sponsor_touches',
  'sponsors',
  'lead_magnet_claims',
  'preschool_founding_claims',
  'preschool_claim_history',
  'navigator_marketing_contacts',
];
const sensitiveAnon = policies.filter(
  (p) => SENSITIVE.includes(p.table) && p.roles.some((r) => r === 'anon' || r === 'public'),
);
check(
  'sensitive tables carry no anon/public policy at all',
  sensitiveAnon.length === 0,
  sensitiveAnon,
);

/* ── 3. table-grant rules across every migration ──────────────────────── */

const grantStmts = allSql.match(/grant [^;]+;/g) ?? [];
const anonTableWriteGrant = grantStmts.filter(
  (g) =>
    /\b(insert|update|delete|truncate|all)\b/.test(g.replace(/grant execute[^;]+/, '')) &&
    !g.includes('execute') &&
    /\bto [^;]*\banon\b/.test(g),
);
check(
  'no migration grants table writes to anon',
  anonTableWriteGrant.length === 0,
  anonTableWriteGrant,
);
const blanketAuthGrant = grantStmts.filter(
  (g) => /grant all on (?:table )?public\./.test(g) && /\bto [^;]*\b(anon|authenticated)\b/.test(g),
);
check('no blanket table GRANT ALL to API roles', blanketAuthGrant.length === 0, blanketAuthGrant);

/* ── 4. the 054 lockdown, statement by statement ──────────────────────── */

const m054 = sqlOf.get('054_public_api_surface_lockdown.sql') ?? '';
check('054 exists', m054.length > 0);
check(
  '054: guard function is created idempotently and runs as INVOKER',
  m054.includes('create or replace function public.tlws_block_api_writes()') &&
    !/tlws_block_api_writes\(\)[^;]*security definer/.test(m054),
);
check(
  '054: guard rejects the API roles with insufficient_privilege',
  m054.includes(`current_user in ('anon', 'authenticated')`) &&
    m054.includes('insufficient_privilege'),
);
check(
  '054: guard trigger covers every write verb on spatial_ref_sys',
  /create trigger tlws_spatial_ref_sys_write_guard before insert or update or delete or truncate on public\.spatial_ref_sys for each statement/.test(
    m054,
  ),
);
check(
  '054: trigger creation is idempotent (drop if exists first)',
  m054.indexOf('drop trigger if exists tlws_spatial_ref_sys_write_guard') <
    m054.indexOf('create trigger tlws_spatial_ref_sys_write_guard') &&
    m054.includes('drop trigger if exists'),
);
check(
  '054: the guard itself is not /rpc-callable',
  /revoke execute on function public\.tlws_block_api_writes\(\) from public, anon, authenticated/.test(
    m054,
  ),
);
for (const t of ['community_profiles', 'location_history', 'location_submissions']) {
  check(`054: revokes drifted write grants on ${t}`, m054.includes(`'${t}'`));
}
check(
  '054: drifted-table loop revokes exactly insert/update/delete from both API roles',
  /revoke insert, update, delete on public\.%i from anon, authenticated/.test(m054),
);
check(
  '054: schema-wide TRUNCATE revoke loops over pg_tables',
  m054.includes('revoke truncate on public.%i from anon, authenticated') &&
    m054.includes(`from pg_tables where schemaname = 'public'`),
);
check(
  '054: preschool_enforce_capacity loses EXECUTE including PUBLIC',
  /revoke execute on function public\.preschool_enforce_capacity\(\) from public, anon, authenticated/.test(
    m054,
  ),
);
check(
  '054: record_directory_view becomes service-role-only (PUBLIC included)',
  /revoke all on function public\.record_directory_view\(uuid\) from public, anon, authenticated/.test(
    m054,
  ) && /grant execute on function public\.record_directory_view\(uuid\) to service_role/.test(m054),
);
check(
  '054: never enables RLS it cannot enable and never drops anything',
  !/alter table (?:only )?public\.spatial_ref_sys enable row level security/.test(m054) &&
    !/drop table|drop policy/.test(m054),
);
check('054: creates no policies (grants + trigger only)', !m054.includes('create policy'));

/* ── 5. service-role key stays server-only ────────────────────────────── */

function walk(dir: string, out: string[] = []): string[] {
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) walk(rel, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(rel);
  }
  return out;
}
const srcFiles = walk('src');
const keyRefs = srcFiles.filter((f) =>
  fs.readFileSync(path.join(root, f), 'utf8').includes('SUPABASE_SERVICE_ROLE_KEY'),
);
check(
  'the service-role key is referenced only by the admin client module',
  keyRefs.length === 1 && keyRefs[0] === 'src/lib/supabase/admin.ts',
  keyRefs,
);
const adminSrc = fs.readFileSync(path.join(root, 'src/lib/supabase/admin.ts'), 'utf8');
check(`admin client is guarded by 'server-only'`, adminSrc.includes(`import 'server-only'`));
const clientSrc = fs.readFileSync(path.join(root, 'src/lib/supabase/client.ts'), 'utf8');
check(
  'browser client uses only NEXT_PUBLIC env',
  !/process\.env\.(?!NEXT_PUBLIC_)/.test(clientSrc),
);
const adminImporters = srcFiles.filter((f) =>
  fs.readFileSync(path.join(root, f), 'utf8').includes("from '@/lib/supabase/admin'"),
);
const clientSideAdmin = adminImporters.filter((f) => {
  const head = fs.readFileSync(path.join(root, f), 'utf8').slice(0, 200);
  return /^\s*['"]use client['"]/.test(head);
});
check(
  'no client component imports the admin client',
  clientSideAdmin.length === 0,
  clientSideAdmin,
);
check('the admin client has server-side importers at all', adminImporters.length >= 10);

/* ── 6. the owner-run live verifier exists and probes the right things ── */

const verifier = fs.existsSync(path.join(root, 'scripts/verify-rls-live.sh'))
  ? fs.readFileSync(path.join(root, 'scripts/verify-rls-live.sh'), 'utf8')
  : '';
check('verify-rls-live.sh exists', verifier.length > 0);
for (const probe of [
  'spatial_ref_sys',
  'applications',
  'leads',
  'sms_consents',
  'record_directory_view',
  'locations',
  'campaign_progress',
]) {
  check(`live verifier probes ${probe}`, verifier.includes(probe));
}
check(
  'live verifier takes the anon key from the environment, not a hardcoded secret',
  verifier.includes('SUPABASE_ANON_KEY') && !/eyJ[A-Za-z0-9_-]{20,}/.test(verifier),
);

console.log(`supabase-rls-contract: ${passed} passed, ${failed} failed`);
if (failed) process.exit(1);
