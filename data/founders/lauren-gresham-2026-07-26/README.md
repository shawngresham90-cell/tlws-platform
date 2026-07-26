# Founders Wall — add Lauren Gresham (Steel Founder)

**Status: EXECUTED 2026-07-26, verified.** See the execution audit at the bottom.

The section immediately below was written before execution and is kept as the
record of what was proposed and why.

## The thing to know first

The Founders Wall is **entirely database-backed**. `/founders` reads the
`founders` table and the `campaign_progress` view; `$9,055` and `$2,495` appear
**nowhere in the codebase** — a repository-wide search for them returns nothing.

That has one consequence worth being blunt about: **merging a pull request
cannot change the wall.** The only thing that can is a write to the production
database, and that write is live the moment it runs — there is no preview of it
and no review gate in front of it.

Shawn asked not to publish until he had reviewed the wall. Honouring that means
preparing the change and stopping here, rather than writing to production and
showing him afterwards.

## Verification already done (read-only, 2026-07-26)

| Check | Result |
| --- | --- |
| Is Lauren Gresham already present? | **No** — 0 rows match `lauren` |
| Other Gresham rows (different people) | David Gresham (Iron #1), J.A. Gresham (Brick #5) — untouched |
| Founders on the wall | 26, all public |
| Steel tier | positions 1–8 filled → Lauren takes **9** |
| `campaign_settings.goal_cents` | 1155000 = **$11,550** (already correct) |
| `campaign_settings.raised_cents_override` | 905500 = **$9,055** |
| `campaign_progress` view | founder_count 26, remaining 249500 = $2,495 |

## What the change does

Two writes, one transaction:

1. Insert **one** founder — `Lauren Gresham`, tier `steel`, position `9`,
   `is_public = true`, `status = approved`, `amount_cents = 50000`.
2. Set `campaign_settings.raised_cents_override` to `955500`.

Everything else is derived and updates itself:

| Figure | Before | After | Where it comes from |
| --- | --- | --- | --- |
| Raised | $9,055 | **$9,555** | `raised_cents_override` |
| Remaining | $2,495 | **$1,995** | `remainingCents(goal, raised)` |
| Goal | $11,550 | $11,550 | unchanged |
| Founder count | 26 | **27** | count of published founder rows |
| Progress | 78.4% | ~82.7% | `pctToGoal(goal, raised)` |

`$9,555 + $1,995 = $11,550` ✓ — asserted inside the transaction, which rolls
back if it does not hold.

## Ordering and design are preserved

Lauren is appended at Steel **position 9**. No existing row's tier, position,
name or visibility is touched — the statement contains no `update` against
`founders` at all, and the test asserts that. The wall groups by tier and orders
by position, so the existing recognition order is unchanged and Lauren appears
last in Steel.

## Her $500 is stored but not displayed

`amount_cents = 50000` is recorded for the admin view only. The public reader
(`src/lib/community/founders.ts`) selects
`id, display_name, business_name, business_url, tier, position, message,
logo_url, paid_at` — **`amount_cents` is not in the projection**, so no
individual amount reaches the page, and an existing test scans the components to
keep it that way.

That matches every other founder: individual amounts are not displayed for
anyone, so Lauren's is not displayed either. (For reference, RUSH's Steel spot is
stored the same way, at the same $500.)

## Two ways to apply it

**A — Shawn does it himself in the admin UI (recommended).** `/admin/founders`
already supports exactly this: *Add founder* (name, tier Steel, position 9,
published) and *Set raised override* to `9555`. He sees the result immediately
and nobody else touches production.

**B — say the word and the prepared statement is run.** `ADD-FOUNDER.sql` is
idempotent-by-precondition: it refuses if Lauren already exists, if the wall is
not at 26 founders, if Steel #9 is taken, or if the totals are not the ones it
was written against. Any surprise aborts the whole transaction.

Either way, `VERIFY.sql` confirms the result and `ROLLBACK.sql` reverses it
exactly.

## Files

| File | |
| --- | --- |
| `ADD-FOUNDER.sql` | the guarded forward statement — **run once, 2026-07-26** |
| `VERIFY.sql` | read-only checks, safe before and after |
| `ROLLBACK.sql` | guarded reversal to 26 founders / $9,055 — **not run** |

---

# EXECUTED — 2026-07-26

Authorized by Shawn and run exactly once. CI on PR #193 was green
(`verify` success, Netlify header + redirect rules success on `bd3692f`)
before execution.

## Preconditions re-confirmed immediately before running

| Guard | Required | Found |
| --- | --- | --- |
| Founders on the wall | 26 | **26** ✓ |
| Rows matching `lauren` | 0 | **0** ✓ |
| Steel position 9 | free | **free** (steel 1–8 filled) ✓ |
| `raised_cents_override` | 905500 | **905500** ✓ |
| `goal_cents` | 1155000 ($11,550) | **1155000** ✓ |

Pre-state digest of all 26 founder rows:
`f0b1346a90caca328d8fcc19a7d18331`

## Execution

The transaction ran once. No guard raised, so nothing rolled back and no guard
was modified or weakened. The rollback was **not** run.

## Verification (VERIFY.sql)

| Check | Result |
| --- | --- |
| Founders total | **27** ✓ |
| Lauren Gresham rows | **exactly 1** ✓ |
| Tier / position / published | **steel / 9 / true** ✓ |
| Status | `approved` |
| Stored contribution | `amount_cents = 50000` (**$500**) ✓ |
| Raised | **955500 = $9,555** ✓ |
| Remaining | **199500 = $1,995** ✓ |
| Goal | **1155000 = $11,550** — unchanged ✓ |
| Progress | **82.7%** ✓ |
| `raised + remaining = goal` | **true** ✓ |

## Nothing else moved

Digest of the 26 pre-existing founder rows **after** execution:
`f0b1346a90caca328d8fcc19a7d18331` — **byte-identical to the pre-state digest.**
David Gresham (Iron #1), J.A. Gresham (Brick #5) and all 24 others are
provably unchanged: same values, same order, same visibility.

Steel tier after: 1 Gary Ford · 2 Jose Cotto · 3 Greg Walker · 4 Mario Capston ·
5 Jon Blankenship · 6 Ricky M. Rosenbalm · 7 Idle Demon · 8 RUSH ·
**9 Lauren Gresham**. Positions 1–8 untouched.

Unrelated tables unchanged: `locations` 1556 rows, digest
`911773b876a3a93897401406a14616e2` (identical to before); `sponsors` 0;
`sponsor_touches` 0; `directory_sponsors` 0.

## Live page

`https://truckinglifewithshawn.com/founders` could **not** be fetched from this
environment — the network policy blocks the production domain and the
`*.netlify.app` alias, and that was not bypassed. Verified instead against the
production database plus the page's data contract:

- `/founders` has `export const revalidate = 60`, so the ISR cache refreshes
  within 60 seconds of the write. No on-demand purge was needed.
- `getPublicFounders()` selects `is_public = true` rows ordered by position —
  Lauren qualifies and sorts last in Steel.
- `getCampaignProgress()` reads `campaign_progress`, which now returns
  founder_count 27, raised 955500, remaining 199500, 82.7%.

Shawn should confirm the rendered wall himself; the data behind it is verified.

## One honest nuance about the $500

**Not displayed — confirmed.** `getPublicFounders()` selects
`id, display_name, business_name, business_url, tier, position, message,
logo_url, paid_at`. `amount_cents` is not in the projection, so no individual
amount reaches the page, for Lauren or anyone.

**Not *exposed* — not strictly true, and it predates this change.** At the
database grant level the `anon` role holds SELECT on the whole `founders` table
for public rows, `amount_cents` included (also `payment_ref`,
`payment_provider`, `status`). Anyone querying the public Supabase REST API
directly with the anon key could read it. That is exactly as true for RUSH's
$500 Steel spot, stored the same way since 2026-07-14, as it now is for
Lauren's.

This was **not** introduced here and closing it is a schema decision for Shawn,
because it affects every founder row:

```sql
-- Not run. Narrows the public projection to what the site actually reads.
revoke select on public.founders from anon;
grant select (id, display_name, business_name, business_url, tier,
              position, message, logo_url, paid_at, is_public)
  on public.founders to anon;
```

The alternative is to store `amount_cents = null` for Lauren, matching the 24
seeded founders — but that discards the record of an authorized contribution
that Shawn asked to be captured, so it was not done unilaterally.
