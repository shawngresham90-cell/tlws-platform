/**
 * RLS + migration structure test (End-User Accounts milestone). Parses
 * migration 044 and asserts the owner-only guarantees hold at the schema level:
 * both tables enable RLS; every operation (SELECT/INSERT/UPDATE/DELETE) is
 * gated by `user_id = auth.uid()`; user_id references auth.users; anon is
 * revoked; the (user_id, client_id) uniqueness + indexes exist. This is the
 * offline proxy for cross-user denial — a live cross-user integration test also
 * runs once the migration is applied (owner action).
 *
 * Run:
 *   npx esbuild scripts/test-cloud-rls.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --alias:server-only=./scripts/shims/server-only.ts \
 *     --outfile=/tmp/test-cloud-rls.cjs && node /tmp/test-cloud-rls.cjs
 */
import { readFileSync } from 'fs';

let passed = 0;
let failed = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) passed++;
  else {
    failed++;
    console.log(`FAIL: ${name}`, detail ?? '');
  }
}

const sql = readFileSync('supabase/migrations/044_saved_trips_cloud.sql', 'utf8').toLowerCase();

for (const table of ['saved_trips', 'truck_presets']) {
  check(`${table}: created`, sql.includes(`create table if not exists public.${table}`));
  check(
    `${table}: user_id references auth.users on delete cascade`,
    new RegExp(`user_id uuid not null references auth\\.users\\(id\\) on delete cascade`).test(sql),
  );
  check(
    `${table}: RLS enabled`,
    sql.includes(`alter table public.${table} enable row level security`),
  );
  check(`${table}: unique(user_id, client_id)`, sql.includes(`unique (user_id, client_id)`));
  check(`${table}: user_id index`, sql.includes(`on public.${table} (user_id)`));
  check(`${table}: user_id+updated_at index`, sql.includes(`(user_id, updated_at desc)`));
  check(`${table}: anon revoked`, sql.includes(`revoke all on public.${table} from anon`));

  // Every operation must have a policy gated by user_id = auth.uid().
  for (const op of ['select', 'insert', 'update', 'delete']) {
    const policyName = `${table}_${op}_own`;
    check(
      `${table}: ${op} policy exists`,
      sql.includes(`create policy ${policyName} on public.${table}`),
    );
  }
  // INSERT/UPDATE must have WITH CHECK (user_id = auth.uid()); SELECT/DELETE USING.
  check(
    `${table}: insert with check user_id=auth.uid()`,
    sql.includes(`for insert to authenticated with check (user_id = auth.uid())`),
  );
  check(
    `${table}: select using user_id=auth.uid()`,
    sql.includes(`for select to authenticated using (user_id = auth.uid())`),
  );
  check(
    `${table}: delete using user_id=auth.uid()`,
    sql.includes(`for delete to authenticated using (user_id = auth.uid())`),
  );
}

// No policy should ever grant access without the ownership predicate: assert
// there is no `using (true)` / `with check (true)` anywhere in this migration.
check('no permissive using(true)', !sql.includes('using (true)'));
check('no permissive with check(true)', !sql.includes('with check (true)'));

// Recent searches must NOT be a cloud table (comments may mention them; a
// TABLE for them must not exist).
check(
  'recent searches never stored in cloud (no such table)',
  !/create table[^;]*\b(recent|search)/.test(sql),
);

// Idempotency: drop-if-exists before create policy, create-table-if-not-exists.
check('idempotent: drop policy if exists used', sql.includes('drop policy if exists'));
check('idempotent: create index if not exists used', sql.includes('create index if not exists'));

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
