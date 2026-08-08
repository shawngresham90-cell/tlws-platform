# Founder Wall privacy hardening — least-privilege grants

**Status: APPLIED to production 2026-07-26, verified. Rollback not run.**

Permission-only. No founder row was read into, written to, or altered. The
digest of all 27 founder rows is byte-identical before and after.

---

## The exposure

`/founders` never displays an individual contribution. The database never
stopped anyone from asking for one.

RLS on `public.founders` is a **row** filter — `anon_read_founders USING
(is_public = true)`. It says nothing about **columns**. The `anon` role, which
every unauthenticated PostgREST request runs as, held table-level `SELECT`,
i.e. all sixteen columns:

```
amount_cents · business_name · business_url · created_at · display_name · id
is_public · logo_url · message · paid_at · payment_provider · payment_ref
position · status · tier · updated_at
```

So this returned real data to anyone with the anon key — which ships in the
browser bundle and is public by design:

```
GET /rest/v1/founders?select=display_name,amount_cents,payment_ref,payment_provider,status
```

`campaign_settings` was worse on paper: `anon` held `INSERT`, `UPDATE`,
`DELETE` and `TRUNCATE` on it as well as `SELECT`. RLS blocked the DML (no
write policy exists) — but **`TRUNCATE` is not subject to RLS**. Only the
absence of a code path stood in front of it. The same stray `TRUNCATE` grant
sat on `founders`, and `authenticated` held the identical set.

This was not introduced by the Lauren Gresham addition. It predates it and
applied equally to RUSH's identically-stored $500 Steel spot since 2026-07-14.
It was surfaced during that verification and is closed here.

## Before → after

| Object | Role | Before | After |
| --- | --- | --- | --- |
| `founders` | anon, authenticated | `SELECT` (all 16 cols), `REFERENCES`, `TRIGGER`, `TRUNCATE` | `SELECT` on **10 columns** only |
| `campaign_settings` | anon, authenticated | `ALL` (incl. INSERT/UPDATE/DELETE/TRUNCATE) | `SELECT` on `id`, `goal_cents`, `raised_cents_override` |
| `campaign_progress` | anon, authenticated | `ALL` | `SELECT` |
| `founders` RLS | — | `anon_read_founders USING (is_public = true)` | **unchanged** |
| founder rows | — | 27 | **27, byte-identical** |

The 10 columns anon keeps are exactly what the page reads: the 9 in
`getPublicFounders()`, plus `is_public` — required because the reader filters
`.eq('is_public', true)` and a `WHERE` clause needs `SELECT` privilege on the
column it references. `is_public` is `true` for every row a public caller can
see, so it discloses nothing.

## The one real obstacle, and why the view changed

`campaign_progress` is `security_invoker = true`: its body runs with the
**caller's** privileges. Its body computed

```sql
coalesce(sum(founders.amount_cents), 0) as amount_sum
```

as a fallback for `raised_cents`. That single reference is the only reason
`anon` needed `SELECT` on `amount_cents` at all — revoke the column and the
thermometer 500s.

The fallback was also dead and wrong. Migration 026, which introduced it, states
in its own header that individual amounts "are not summed to produce the public
total". The public total is the aggregate `raised_cents_override` — 955500
($9,555). Only 2 of the 27 founders carry a non-null `amount_cents`, so if the
fallback ever fired it would report **$1,000**, not $9,555.

So the view now reads the aggregate only. Column names, order and types are
identical, `security_invoker = true` is retained, and every existing reader
keeps working.

**The alternative was worse.** Flipping the view to `security_invoker = false`
would let it read the column with the owner's rights — keeping a privileged
dependency on payment data and tripping Supabase's `security_definer_view`
lint. Removing the dependency beats hiding it. Confirmed: the security advisor
list is identical before and after, with no new findings.

## Proof

Executed as `anon` — the exact role PostgREST assumes per request. (The Supabase
REST endpoint is blocked by this environment's egress policy, so the proof is
`SET ROLE anon` in-database, which is the same mechanism PostgREST uses to
downgrade a request from its connection role.)

```
founders.amount_cents         => denied 42501
founders.payment_ref          => denied 42501
founders.payment_provider     => denied 42501
founders.status               => denied 42501
founders.created_at           => denied 42501
founders.updated_at           => denied 42501
select * from founders        => denied 42501
campaign_settings.updated_at  => denied 42501
UPDATE campaign_settings      => denied 42501
DELETE founders               => denied 42501
TRUNCATE founders             => denied 42501
approved 9-column projection  => ALLOWED (expected)
campaign_progress view        => ALLOWED (expected)
```

`42501` is `insufficient_privilege`.

| Required proof | Result |
| --- | --- |
| 1. Approved public projection succeeds | ✓ 9 columns, 27 rows |
| 2. Lauren appears as Steel Founder #9 | ✓ `Lauren Gresham / steel #9` |
| 3. Payment / amount / status columns denied | ✓ all denied, 42501 |
| 4. Unpublished founders inaccessible | ✓ see below |
| 5. Admin access still works | ✓ see below |
| 6. No founder data value changed | ✓ digests identical |

**Steel tier as anon, after:** 1 Gary Ford · 2 Jose Cotto · 3 Greg Walker ·
4 Mario Capston · 5 Jon Blankenship · 6 Ricky M. Rosenbalm · 7 Idle Demon ·
8 RUSH · **9 Lauren Gresham**.

**Thermometer as anon, after:** founder_count 27 · raised 955500 ($9,555) ·
goal 1155000 ($11,550) · remaining 199500 ($1,995) · 82.7% ·
`raised + remaining = goal` true.

### 4. Unpublished founders

All 27 founders are published, so there was no unpublished row to test against —
and fabricating one permanently was not acceptable. `PROVE-UNPUBLISHED.sql`
inserts a throwaway unpublished row carrying values in exactly the forbidden
columns, checks it as `anon`, and **rolls the whole transaction back**:

```
rows inside txn (as postgres): 28
anon sees the unpublished probe row: 0   (expected 0)
anon sees any unpublished row:       0   (expected 0)
anon total visible:                 27   (expected 27, not 28)
anon read amount_cents:         denied 42501
```

After rollback: 27 founders, 0 unpublished, 0 probe rows, digest unchanged.

### 5. Admin

Every admin read and write goes through `createAdminClient()` → the
`service_role` key, which bypasses RLS and column grants entirely, so nothing
here can reach it. Verified as `service_role`: 27 rows visible, 2 with
`amount_cents`, 27 with `status`, goal 1155000, override 955500.

### 6. Nothing moved

| Digest | Before | After |
| --- | --- | --- |
| All 27 founder rows | `ab4b8597a81da1675e4b0daa3e0763d3` | **identical** |
| The 26 pre-Lauren rows | `f0b1346a90caca328d8fcc19a7d18331` | **identical** |

`goal_cents` 1155000 and `raised_cents_override` 955500 unchanged. RLS enabled,
policy expression unchanged.

## Execution record

A full dry run was executed first — the identical statement with `rollback` in
place of `commit`. Every precondition, post-check and anon denial passed, and
the catalogs afterwards were byte-identical (16 columns still granted, view md5
`5cb0105c…`, digest `ab4b8597…`). Only then was the real statement run, once.
No guard raised, so nothing rolled back and no guard was weakened.

## Files

| File | |
| --- | --- |
| `APPLY.sql` | the guarded forward statement — **run once, 2026-07-26** |
| `VERIFY.sql` | read-only checks, safe before and after |
| `PROVE-UNPUBLISHED.sql` | rolled-back probe; commits nothing |
| `ROLLBACK.sql` | exact reversal to the prior grants and view — **not run** |

## Out of scope, but found — for Shawn

The blanket-grant pattern is not limited to the Founder Wall. The same audit
found `anon` holding grants it has no use for elsewhere:

- **`TRUNCATE` for `anon` and `authenticated`** on ~20 tables including
  `leads`, `sponsors`, `sponsor_touches`, `applications`, `location_reviews`,
  `content_pages`, `kc_articles`, `tests`, `test_attempts`,
  `directory_sponsors`, `lead_magnet_claims`. TRUNCATE ignores RLS.
- **Full `INSERT`/`UPDATE`/`DELETE`** for `anon` on `community_profiles`,
  `location_history`, `location_submissions`, and the PostGIS views.
- `spatial_ref_sys` has RLS disabled entirely (a standing Supabase advisor
  ERROR, PostGIS-owned).

None of these are Founder Wall surfaces, so this change deliberately leaves them
alone rather than quietly widening its own blast radius. They are worth a
follow-up pass with the same guarded-transaction treatment.

One more, unrelated to privacy: `founders` and `campaign_settings` have read
policies for `anon` only, not `authenticated`. A visitor signed in through
Supabase auth therefore sees an empty wall and a $0 thermometer on the homepage
`ProofBar`/`FoundersWall` sections, which use the cookie-scoped client. The
`/founders` page itself is unaffected — it uses the cookieless anon client. That
is a pre-existing correctness bug, not something this change introduced or
altered, and fixing it means adding `authenticated` to those policies.
