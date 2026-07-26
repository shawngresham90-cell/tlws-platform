# Founders Wall — add Lauren Gresham (Steel Founder)

**Status: prepared, verified, NOT RUN.** Awaiting Shawn's go-ahead.

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
| `ADD-FOUNDER.sql` | the guarded forward statement — **not run** |
| `VERIFY.sql` | read-only checks, safe before and after |
| `ROLLBACK.sql` | guarded reversal to 26 founders / $9,055 |
