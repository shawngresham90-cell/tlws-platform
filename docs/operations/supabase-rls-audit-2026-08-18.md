# Supabase RLS security audit — 2026-08-18

Triggered by the Supabase Security Advisor email of Aug 17 2026 reporting
**"Table publicly accessible" (`rls_disabled_in_public`)** against the
tlws-platform project. This audit covers ONLY the tlws-platform Supabase
project (`cgvxwvymkembftznhcdl`); the older TruckLifePWA project is out of
scope and was not touched.

Method: evidence-first. Every statement below was verified against the live
catalog (advisor API, `pg_class`, `pg_policies`,
`information_schema.role_table_grants` / `column_privileges`, function
sources) and against the repository (migrations, both Supabase client
constructors, every `.from()`/`.rpc()` call site). Where a capability
mattered, it was proven with a **rolled-back probe** — a `DO` block that
attempts the operation and aborts via exception so nothing persists.

## 1. The exact finding

The advisor reports exactly **one** `rls_disabled_in_public` ERROR:

> Table `public.spatial_ref_sys` is public, but RLS has not been enabled.

`spatial_ref_sys` is PostGIS's SRID reference catalog (~8,500 rows of public
EPSG coordinate-system definitions — no user data). It is **not** an
application table, but the exposure is real:

- Owner: `supabase_admin`. ACL: `arwdDxtm` (ALL, including INSERT/UPDATE/
  DELETE/TRUNCATE) granted to `postgres`, `anon`, `authenticated`,
  `service_role` — **all granted by `supabase_admin`** — plus world SELECT.
- RLS: disabled.
- **Probe (2026-08-18, rolled back): `INSERT` into `spatial_ref_sys` as the
  `anon` role SUCCEEDED.** Anyone holding the publishable anon key — i.e.
  every site visitor — can insert, update, or delete rows through PostgREST.
- Impact class: **integrity / denial-of-service, not privacy.** The rows are
  public reference data, but corrupting or deleting SRID 4326 breaks every
  geography calculation the directory, `nearby_locations`, and the trip
  planner perform.

Why the standard fix doesn't apply (each probed, not assumed):

| Attempted as `postgres` (the migration role) | Result |
| --- | --- |
| `alter table public.spatial_ref_sys enable row level security` | `insufficient_privilege` — postgres is not the owner |
| `revoke insert/update/delete/truncate … from anon, authenticated` | silent no-op — the grants were made by `supabase_admin`; anon still held INSERT afterwards (verified in-transaction, rolled back) |

What postgres **does** hold on the table is TRIGGER privilege — so migration
054 installs a statement-level guard trigger that rejects
INSERT/UPDATE/DELETE/TRUNCATE arriving as `anon` or `authenticated`, while
leaving SELECT open (PostGIS reads this catalog during geography operations
executed as the calling role, and the data is public). That closes the write
path at the data layer. The advisor lint itself will keep firing — it checks
the RLS flag, which only Supabase can change here — see "Owner decisions".

Every one of the 34 application tables already has RLS enabled (migrations
010 onward did this correctly). The 17 `rls_enabled_no_policy` INFO notices
are **deliberate**: those tables are server-only; RLS-enabled-with-no-policy
is Postgres's default-deny, which is exactly the intended posture.

## 2. Architecture (verified in `src/`)

- `src/lib/supabase/client.ts` (browser) and `static.ts` (build/ISR) use only
  the **anon** key. Every `.from()` they reach is a read of published public
  content, or a user-owned table gated by `auth.uid()` policies.
- `src/lib/supabase/admin.ts` is the **only** construction of the
  service-role client; it is `server-only` and the key comes from
  `SUPABASE_SERVICE_ROLE_KEY` (server env). All 48 importers are server
  actions, API routes, or admin pages. **No service-role key is referenced
  client-side.** No secrets appear in the repository.
- **Every public form write** (applications step1/2, leads, sponsor
  inquiries, preschool claims, directory submissions/reviews/parking
  reports, SMS consents, test attempts) goes through an `/api/*` route or
  server action using the service-role client. Anon needs — and effectively
  has — **zero** write capability on application tables.

## 3. Authorization matrix

Classes: **A** public read-only · **B** public insert-only · **C**
authenticated user-owned · **D** admin/server-only · **E** internal /
non-Data-API · **F** unknown/owner decision.

Grant letters = grant-layer only (S/I/U/D + T=TRUNCATE, R=REFERENCES,
G=TRIGGER). **Effective access = grants ∩ RLS**; on tables with no policy,
effective anon/authenticated access is NONE regardless of grants.

| Table | RLS | anon grants | auth grants | Effective anon | Client code | Server code | Sensitivity | Class / policy verdict |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| locations | ✓ | S(+RGT) | same | SELECT published, non-deleted | reads | service-role writes | public directory data | **A** — correct |
| kc_articles / kc_categories / kc_related | ✓ | S(+RGT) | same | SELECT published/active | reads | service-role writes | public content | **A** — correct |
| tests / questions | ✓ | S(+RGT) | same | SELECT published | reads | service-role writes | public content | **A** — correct |
| content_pages | ✓ | S(+RGT) | same | SELECT published | reads | service-role writes | public content | **A** — correct |
| founders | ✓ | none | none | SELECT is_public (policy; PUBLIC role) | reads | service-role writes | names only, aggregate money | **A** — correct (col-safe by reader) |
| campaign_settings | ✓ | column S (id, goal_cents, raised_cents_override) | same | SELECT 3 columns, via view | reads via `campaign_progress` | service-role writes | public campaign numbers | **A** — exemplary column-level grant |
| directory_sponsors | ✓ | S(+RGT) | same | SELECT active | reads | service-role writes | public sponsor placements | **A** — correct |
| directory_slug_redirects | ✓ | S(+RGT) | same | SELECT all | reads | service-role writes | slugs | **A** — correct |
| preschool_founding_students | ✓ | S | S | SELECT is_published | reads | service-role writes | first name/initial wall | **A** — correct |
| lead_magnets | ✓ | S(+RGT) | same | SELECT is_active | reads | service-role writes | public catalog | **A** — correct |
| saved_trips | ✓ | none | ALL | none / own rows CRUD | authenticated reads+writes | service-role | user trip data | **C** — correct (`auth.uid()` on all four verbs) |
| truck_presets | ✓ | none | ALL | none / own rows CRUD | authenticated reads+writes | service-role | user truck config | **C** — correct |
| admin_users | ✓ | none | ALL | none / self-read; owner-role read+write | `lib/auth.ts` self-check | service-role admin | admin roster | **C/D** — correct (policies call `admin_role()`) |
| applications | ✓ | S,R,G,T* | same | **none** (no policy) | — | service-role only | **PII: name, email, phone, consents** | **D** — correct; grants are dead letters under RLS |
| application_events | ✓ | S,R,G,T* | same | none | — | service-role only | app event trail | **D** — correct |
| leads | ✓ | S,R,G,T* | same | none | — | service-role only | **PII: email, phone** | **D** — correct |
| sms_consents | ✓ | none | none | none | — | service-role only | **PII + legal consent records** | **D** — exemplary (046) |
| location_submissions | ✓ | ALL* → fixed | same | none | — | service-role only | **PII: submitter name/contact** | **D** — 054 revokes the drifted write grants |
| location_reviews | ✓ | S,R,G,T* | same | none | anon read returns empty (no policy; 0 rows) | service-role only | names + review text | **D** today; see owner decision #3 |
| community_profiles | ✓ | ALL* → fixed | same | none | — | service-role only | **PII: display name, contact** | **D** — 054 revokes the drifted write grants |
| location_history | ✓ | ALL* → fixed | same | none | — | service-role only | edit audit trail | **D** — 054 revokes the drifted write grants |
| location_duplicate_ignores / location_pair_decisions | ✓ | none | none | none | — | service-role only | admin tooling | **D** — correct |
| preschool_founding_claims / preschool_claim_history | ✓ | none | none | none | — | service-role only | **PII: claimant contact** | **D** — correct |
| sponsors / sponsor_touches | ✓ | S,R,G,T* | same | none | — | service-role only | inquiry contacts | **D** — correct |
| lead_magnet_claims | ✓ | S,R,G,T* | same | none | — | service-role only | claim emails | **D** — correct |
| test_attempts | ✓ | S,R,G,T* | same | none | — | service-role only | anonymous attempt stats | **D** — correct |
| directory_view_daily | ✓ | none | none | none direct; +1/day via `record_directory_view` RPC | RPC call | service-role reads | view counters | **D** with an intentional public counter RPC (bounded upsert) |
| spatial_ref_sys | **✗** (unfixable by postgres) | ALL (unrevocable) | same | SELECT + **writes until 054's guard** | PostGIS internal reads | PostGIS internal | public EPSG data, load-bearing | **E** — guard trigger blocks API-role writes; lint itself needs Supabase (owner decision #1) |
| *views:* campaign_progress | security_invoker | S | S | aggregate numbers | reads | — | public | safe — invoker + column grants |
| *views:* geography_columns / geometry_columns | postgis | ALL (unrevocable) | same | SELECT metadata; writes impossible (non-updatable join views) | — | — | schema metadata | accepted, report-only |

`*` = TRUNCATE (and REFERENCES/TRIGGER) remained granted from Supabase's
defaults. TRUNCATE is the one verb RLS does not govern; PostgREST never
issues it, so it was unreachable — 054 revokes it schema-wide anyway.

Repo migrations 047/049–053 are **not yet applied** to production (ledger
ends at 048): `email_consents`/`email_unsubscribes` (service-role
insert/select only, update/delete revoked even from service_role) and the
five `navigator_*` tables (user-owned policies + revoke-then-grant-back)
already follow the strictest pattern in the repo and will land correctly
when applied.

## 4. Was sensitive data exposed?

**No.** Every PII-bearing table (applications, leads, sms_consents,
location_submissions, community_profiles, preschool claims, sponsors) has
RLS enabled with no anon/authenticated policy — default deny — and this
audit found no policy, view, or SECURITY DEFINER function that pierces that
for the API roles. The only live exposure was **write** access to the
PostGIS reference catalog: an integrity/DoS risk, no personal data. There is
no evidence-based reason to believe any sensitive row was ever readable
anonymously.

SECURITY DEFINER surface, reviewed function by function:

| Function | Verdict |
| --- | --- |
| `record_directory_view(uuid)` | 025 *intended* service-role-only (its only caller is `/api/directory/view` via the admin client, behind a rate limiter) but missed the PUBLIC pseudo-role revoke, so the anon key could still call it directly and spam counters past the limiter — **054 completes the lockdown** |
| `admin_role()` / `is_admin()` | required — `admin_users` policies evaluate them as the calling role; scoped to `auth.uid()`; keep |
| `preschool_enforce_capacity()` | trigger function; not callable via /rpc anyway, but 028 missed the PUBLIC revoke — **054 completes it** |
| `st_estimatedextent(…)` (PostGIS ×3) | reads column stats only; grants unrevocable by postgres; accepted |
| `navigator_reserve_provider_units(…)` | already service-role-only (051/053) |

Storage: **zero buckets, zero storage policies** — no storage surface
exists. Views: `campaign_progress` is `security_invoker` (012/026 doctrine);
the two PostGIS metadata views are non-updatable. Auth: leaked-password
protection is disabled (dashboard setting — owner decision #4).

## 5. What migration 054 changes

1. **`tlws_block_api_writes()` guard trigger on `spatial_ref_sys`** —
   rejects INSERT/UPDATE/DELETE/TRUNCATE from `anon`/`authenticated` with
   `insufficient_privilege`; postgres/supabase_admin (extension upgrades)
   and service_role pass. SELECT untouched.
2. **Revokes the drifted full grants** (insert/update/delete from
   anon+authenticated) on `community_profiles`, `location_history`,
   `location_submissions` — aligning them with 011's doctrine. No effective
   change (RLS already denied); pure defense-in-depth.
3. **Revokes TRUNCATE schema-wide** from the API roles.
4. **Completes the PUBLIC-pseudo-role revokes** that 025 and 028 missed:
   `record_directory_view(uuid)` becomes service-role-only (as 025
   intended — its rate-limited server route keeps working), and
   `preschool_enforce_capacity()` loses its useless EXECUTE.

Expected app impact: **none** — verified against every write path (all
service-role) and every anon read path (none touched). Rollback: five
statements documented in the migration header.

## 6. Owner decisions required

1. **`spatial_ref_sys` advisor ERROR will keep firing** even after 054 — the
   lint checks the RLS flag, which only Supabase can change (table owner is
   `supabase_admin`). Options: (a) open a Supabase support ticket asking
   them to enable RLS + add a permissive SELECT policy on
   `spatial_ref_sys`, or (b) dismiss/acknowledge that one lint in the
   dashboard, citing this audit and the 054 guard. Recommendation: (a),
   then (b) while waiting.
2. **TruckLifePWA project** was named in the same advisor email and is NOT
   covered here. Its findings must be triaged separately (different project,
   possibly genuinely exposed app tables).
3. **`location_reviews` product intent**: approved reviews are currently
   unreadable by the site (no SELECT policy; table empty). If public display
   is ever wanted, that needs a deliberate `status='approved'` SELECT
   policy — not part of this security fix.
4. **Enable leaked-password protection** (dashboard → Auth → Passwords) —
   one toggle, no code.
5. **Apply cadence**: repo migrations 047/049–053 predate 054 and are not
   yet applied. 054 does not depend on them and can be applied first or in
   sequence; `scripts/verify-rls-live.sh` checks the 054 surface either way.

## 7. Verification

- Offline: `scripts/test-supabase-rls-contract.ts` (runs in `npm test`)
  enforces the contract this audit established across all migration files
  and the client-usage rules in `src/`.
- Live (owner-run, after applying 054): `scripts/verify-rls-live.sh` — anon
  REST probes proving sensitive tables deny reads/writes, public content
  stays readable, the view counter still works, and `spatial_ref_sys`
  writes are rejected.
