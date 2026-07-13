# Founders Wall — Source Audit

_Last updated: 2026-07-13_

This document records where the Founders Wall data comes from, what was blocked,
what is now authoritative, and the exact data still outstanding. It exists so the
next person (or the next session) does not re-scrape a blocked source or guess at
values.

## Source of truth

**Authoritative:** founder **screenshots** provided directly by the site owner
(2026-07-13). Names and tiers below are transcribed verbatim from those
screenshots. No names were guessed; no contribution amounts were invented.

**NOT used as a source (by explicit instruction):**

- The legacy website `https://truckinglifewithshawn-website.netlify.app` — the
  agent environment's egress policy **blocks** it at the proxy `CONNECT` layer
  (HTTP 403). This is an organization policy denial, not an origin error. It was
  **not** retried or circumvented.
- Any scrape of the old site.

## Confirmed public aggregate figures

The campaign total is stored as an **aggregate**, independent of any individual
founder's contribution amount (privacy-first model — see below).

| Figure    | Value    | Cents     | Notes                                   |
| --------- | -------- | --------- | --------------------------------------- |
| Goal      | $12,000  | 1,200,000 | Unchanged.                              |
| Raised    | $7,100   | 710,000   | Stored as an override, **not** a sum.   |
| Remaining | $4,900   | 490,000   | Derived: goal − raised.                 |
| Percent   | 59.2%    | —         | Derived: raised ÷ goal.                 |

> If the current screenshots show a **raised** total other than $7,100, that
> number needs to be updated in `campaign_settings.raised_cents_override`
> (migration 026). The figure above is the last value confirmed by the owner.

## Founder roster (from screenshots)

**25 founder spots sold** — Iron 2, Steel 7, Brick 16. This resolves the earlier
**23-vs-25 founder-count conflict**: the wall shows **25 spots**, but one person
(**Jose Cotto**) bought two of them, so there are **24 unique founder names**.

Two counts, used for different things:

- **Founder spots sold: 25** — the wall/occupancy count. Drives tier availability
  and fundraising-wall occupancy.
- **Unique founder names: 24** — informational only.

### Iron (2)

1. David Gresham
2. Thomas Fields

### Steel (7)

1. Gary Ford
2. Jose Cotto  ← _also appears in Brick — see Duplicates_
3. Greg Walker
4. Mario Capston
5. Jon Blankenship
6. Ricky M. Rosenbalm
7. Idle Demon

### Brick (16)

1. Sam Tusk
2. Chris Nalley
3. Terry Hostetler
4. Billy Joe Poole
5. J.A. Gresham
6. R.A. Harper
7. Steve Snyder
8. Jose Cotto  ← _also appears in Steel — see Duplicates_
9. Sean Conway
10. David Chasteen
11. Clint E. Ingram
12. Bryce Jennex
13. Will Bethstern
14. Shell Faroods
15. Phil Tuts
16. Joe Wise

### Multi-spot founder (intentional — not a duplicate error)

- **Jose Cotto** holds **both Steel (#2) and Brick (#8)** on purpose — he
  purchased two separate founder spots. Confirmed by the owner (2026-07-13):
  keep both records, display both, **merge neither, remove neither**, and do not
  treat it as a duplicate problem.
- Counted as **1 Steel spot + 1 Brick spot** = 2 spots, 1 unique person. Tier
  availability and wall occupancy count **spots**, so both count as filled.

## Privacy model (aggregate-only)

- `founders.amount_cents` is **nullable** and treated as **private**. Individual
  amounts are never required, never summed into the public total, never
  distributed across founders, and never rendered in the UI.
- The public reader (`src/lib/community/founders.ts`) **does not select**
  `amount_cents`, so per-founder amounts never leave the database.
- The public "raised" total comes from `campaign_settings.raised_cents_override`,
  stored separately from founder records.
- `founder_count` is derived from the count of **published** founder records
  (`is_public = true`), not from money.

## Tier capacity / open spots

Capacities are **provisional**, carried from the legacy fundraiser structure and
pending confirmation against the screenshots:

| Tier             | Capacity | Filled | Open |
| ---------------- | -------- | ------ | ---- |
| Iron             | 10       | 2      | 8    |
| Steel            | 25       | 7      | 18   |
| Brick            | 50       | 16     | 34   |
| Equipment Sponsor| —        | 0      | —    |
| Student Sponsor  | —        | 0      | —    |

> **Confirm these capacities.** If the screenshots show a different number of
> OPEN slots per tier, update `capacity` in
> `src/components/community/tiers.ts`. Open spots are derived
> (`capacity − published founders in tier`), so correcting the capacity fixes
> the counts everywhere.

## Data still needed (per-founder)

The seed carries **display name + tier + wall position** only. Everything below
is optional and currently null — provide it (via the template) only where it is
publicly shown on the wall. **Do not include private donation amounts.**

```
Display Name | Tier | Business Name | Public Website | Anonymous Yes/No
```

- **Business Name / Public Website** — only if the founder is a business shown on
  the wall. Website links render `rel="sponsored nofollow noopener noreferrer"`.
- **Anonymous Yes/No** — an anonymous founder still counts toward totals but
  should have `is_public = false` (kept off the public wall).
- **Confirm** the tier capacities above (the Jose Cotto two-spot purchase is
  confirmed — both spots kept).

## Applied vs. committed

Nothing here is applied to production. The following are **committed but NOT
applied** and must not be applied or deployed without explicit approval:

- `supabase/migrations/026_founders_aggregate.sql` — nullable amount, wall
  position, `campaign_settings`, aggregate-aware `campaign_progress` view.
- `supabase/migrations/027_founders_wall_seed.sql` — the 25-founder roster.
