# FOUNDER-WALL-FUNDED-1 — founder roster update (2026-08-20)

Incremental founder data change. **Not** a schema migration, and it does not
supersede or rewrite the historical 51-founder reconciliation package in
`data/founders/lauren-gresham-2026-07-26/`.

**Nothing here has been applied.** Production application is a separate,
owner-authorized, post-merge gate.

## What it does

Scope is `public.founders` only. No other table is written, and no statement in
this package references `campaign_settings`.

| Action | Founder | From | To |
| --- | --- | --- | --- |
| Move | Ricky M. Rosenbalm | steel / 8 | **iron / 7** |
| Move | Phil Ciarco — NPM Trucking LLC | steel / 9 | **iron / 8** |
| Add | Wayne's Meat Market | — | **iron / 5** |
| Add | Globe Life | — | **iron / 6** |
| Add | Margaret Abbey | — | **brick / 21** |

The moves are targeted **by verified row id**, and change `tier`, `position`
and `updated_at` only. `amount_cents`, `payment_provider`, `payment_ref`,
`paid_at`, `status` and `is_public` are left exactly as they are.

Iron order after apply: the four existing Iron founders keep positions 1–4, then
Wayne's Meat Market (5), Globe Life (6), Ricky (7), Phil (8).

### Steel positions are vacated, not renumbered

Steel keeps positions `1–7, 10, 11`. Renumbering would have rewritten the stored
position of every surviving Steel founder to close a cosmetic gap. Relative order
is what matters and gaps preserve it exactly; uniqueness within a tier is
asserted explicitly, since the database has no unique index on `(tier, position)`.

## Preflight (production, read-only, 2026-08-20)

| | |
| --- | --- |
| Total founders | **51** |
| Iron / Steel / Brick / Founder-Shirt | **4 / 11 / 20 / 16** |
| Ricky M. Rosenbalm | `4086e3dd-…993a` · steel/8 · exactly one |
| Phil Ciarco — NPM Trucking LLC | `84af1472-…6a4c` · steel/9 · exactly one |
| Wayne's Meat Market / Globe Life / Margaret Abbey | absent |

Matches the known 51-founder roster, so the expected post-state is **54**
founders — iron 8, steel 9, brick 21, founder_shirt 16.

`APPLY.sql` re-asserts every one of these facts inside its own transaction, so a
stale precheck cannot turn into a bad write.

## paid_at — owner-supplied, not invented

`public.founders.paid_at` is `timestamptz NOT NULL DEFAULT now()`. Every founder
row must carry a payment timestamp — there is no way to insert one without it.
Rather than let the default stamp the three new rows with whatever moment APPLY
happens to run, the value is set explicitly:

```sql
\set new_rows_paid_at '2026-08-08'
```

**Owner-supplied 2026-08-21: all three paid on 2026-08-08.** APPLY verifies after
writing that exactly three rows carry that timestamp, and `VERIFY.sql` re-checks it. The placeholder guard is kept: if the value is ever blanked while editing,
the script aborts rather than silently falling back to `now()`.

`amount_cents`, `payment_provider` and `payment_ref` needed no such decision —
all three are nullable, so the new rows carry no money at all. (`amount_cents`
has a `CHECK (amount_cents > 0)`, which `NULL` satisfies.)

> The date was first given as 2026-02-08 and corrected to **2026-08-08**
> ("aug 08"). The two are digit-swaps of each other, and 2026-02-08 would also
> have predated every other `paid_at` in the table, so it was queried before
> APPLY ran. 2026-08-08 sits naturally among the existing dates (Ricky
> 2026-07-13, Phil 2026-08-02). Either way the value does not affect wall order
> — position drives that.

## Order of operations

```
psql "$DATABASE_URL" -f PRECHECK.sql     # read-only; compare to manifest.json
psql "$DATABASE_URL" -f APPLY.sql        # one transaction; self-verifying
psql "$DATABASE_URL" -f VERIFY.sql       # read-only; every row must say PASS
```

`ROLLBACK.sql` restores steel/8 and steel/9 and deletes the three added rows. It
only deletes rows that still carry no payment data, so a row later edited to hold
real payment information is left alone rather than silently destroyed.

## Guards inside APPLY.sql

It aborts if: `paid_at` was blanked; the total is not 51; either moved row
is not the exact reviewed id/name/tier/position; either name is duplicated; any
of the three new names already exists; iron 5–8 or brick 21 is occupied. After
writing it re-checks the totals, that steel 8/9 are vacated, that all five target
names appear exactly once, that no tier has duplicate positions, that both moved
rows kept their financial and payment fields, that the new rows carry no payment
data, and that all three carry the owner-supplied 2026-08-08.
