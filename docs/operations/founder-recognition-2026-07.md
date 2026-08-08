# Founder recognition — four founders, July 2026

**EXECUTION RECORD. Already applied to production. Do not re-run anything here.**

This file documents four authorized founder additions and the campaign-total
change that accompanied them. It is a record of what happened, not a package to
execute. It replaces `founder-davis-claudeton.sql`, an earlier inert package
that described only the first of the four and no longer represented reality
(see [Superseded package](#superseded-package) below).

## Production state after the change

| | Value |
|---|---|
| Founder records | **31** (27 before) |
| `goal_cents` | 1,155,000 — **$11,550**, unchanged throughout |
| `raised_cents_override` | 1,130,500 — **$11,305** |
| `remaining_cents` | 24,500 — **"$245 left to open the school"** |

## The four founders

Each was owner-authorized by name, tier and amount. The wall displays **name and
tier only**.

| Founder | Tier | Contribution | `amount_cents` | `position` |
|---|---|---|---|---|
| Davis Claudeton | Iron | $1,050 | 105000 | 3 |
| Joel Jenkins | Brick | $100 | 10000 | 17 |
| Daniel Quijada | Brick | $100 | 10000 | 18 |
| Frederick C. Knapp | Steel | $500 | 50000 | 10 |

`position` continues each tier's existing sequence. All four rows carry
`is_public = true`, `status = 'approved'`, and NULL for `business_name`,
`business_url`, `message`, `logo_url`.

## Campaign arithmetic

"Remaining" is not stored. The `campaign_progress` view derives it:

```
remaining_cents = GREATEST(goal_cents - raised_cents_override, 0)
```

so the only lever on the public number is `raised_cents_override` in the single
`campaign_settings` row.

```
  goal                    1,155,000   ($11,550)   unchanged
  raised (before)           955,500   ($9,555)
  remaining (before)        199,500   ($1,995)

  + Davis Claudeton         105,000   ($1,050)
  + Joel Jenkins             10,000   ($100)
  + Daniel Quijada           10,000   ($100)
  + Frederick C. Knapp       50,000   ($500)
  ------------------------------------------------
  raised (after)          1,130,500   ($11,305)
  remaining (after)          24,500   ($245)
```

The contribution amounts are recorded in `amount_cents` per founder, but the
public total is **not** derived by summing them — see
[Privacy model](#privacy-model). They agree here because each authorized amount
was added to the aggregate deliberately, one at a time.

## Two writes, not one

The work landed in two owner-authorized transactions, which is why the
intermediate numbers below appear in the history:

| | Transaction 1 — 2026-07-31 22:14:17Z | Transaction 2 — 2026-07-31 23:01:02Z |
|---|---|---|
| Inserted | Davis Claudeton, Joel Jenkins | Daniel Quijada, Frederick C. Knapp |
| Founder count | 27 → 29 | 29 → 31 |
| `raised_cents_override` | 955,500 → 1,070,500 | 1,070,500 → 1,130,500 |
| `remaining_cents` | 199,500 → 84,500 ($845) | 84,500 → 24,500 ($245) |

Transaction 2 was authorized as a single operation covering all four founders,
written against the pre-transaction-1 baseline. Because Davis and Joel were
already recorded, executing it literally would have created duplicate rows and
left `raised_cents_override` untouched (its `WHERE raised_cents_override =
955500` guard would have matched nothing). It was instead run with each of the
four inserts guarded by `WHERE NOT EXISTS`, making the first two correct no-ops
and converging on the authorized end state exactly.

### Transaction 2, as executed

One `DO $$ … $$` block. Every precondition is asserted **inside** the
transaction, so drift between the pre-check and the write aborts rather than
half-applying.

```sql
DO $$
DECLARE g bigint; r bigint; n int; fc int; rem bigint; ins int; total_before int;
BEGIN
  -- guards: assert the exact starting state
  SELECT goal_cents, raised_cents_override INTO g, r FROM campaign_settings WHERE id = true;
  IF g IS DISTINCT FROM 1155000 THEN RAISE EXCEPTION 'goal_cents is %, expected 1155000', g; END IF;
  IF r IS DISTINCT FROM 1070500 THEN RAISE EXCEPTION 'raised_cents_override is %, expected 1070500', r; END IF;

  SELECT count(*) INTO total_before FROM founders;
  IF total_before <> 29 THEN RAISE EXCEPTION 'founders count is %, expected 29', total_before; END IF;

  SELECT count(*) INTO n FROM founders WHERE display_name = 'Davis Claudeton';
  IF n <> 1 THEN RAISE EXCEPTION 'Davis Claudeton rows = %, expected 1', n; END IF;
  SELECT count(*) INTO n FROM founders WHERE display_name = 'Joel Jenkins';
  IF n <> 1 THEN RAISE EXCEPTION 'Joel Jenkins rows = %, expected 1', n; END IF;
  SELECT count(*) INTO n FROM founders
   WHERE display_name IN ('Daniel Quijada','Frederick C. Knapp');
  IF n <> 0 THEN RAISE EXCEPTION 'a new founder already exists (% rows)', n; END IF;

  -- all four authorized founders, inserted only if absent.
  -- 1. Davis Claudeton — iron, 105000 private   (already present: no-op)
  INSERT INTO founders (display_name, business_name, business_url, tier, amount_cents,
                        message, logo_url, payment_provider, payment_ref,
                        is_public, status, position, paid_at)
  SELECT 'Davis Claudeton', NULL, NULL, 'iron', 105000,
         NULL, NULL, NULL, NULL, true, 'approved',
         (SELECT COALESCE(MAX(position),0)+1 FROM founders WHERE tier = 'iron'), now()
  WHERE NOT EXISTS (SELECT 1 FROM founders WHERE display_name = 'Davis Claudeton');

  -- 2. Joel Jenkins — brick, 10000 private      (already present: no-op)
  INSERT INTO founders (display_name, business_name, business_url, tier, amount_cents,
                        message, logo_url, payment_provider, payment_ref,
                        is_public, status, position, paid_at)
  SELECT 'Joel Jenkins', NULL, NULL, 'brick', 10000,
         NULL, NULL, NULL, NULL, true, 'approved',
         (SELECT COALESCE(MAX(position),0)+1 FROM founders WHERE tier = 'brick'), now()
  WHERE NOT EXISTS (SELECT 1 FROM founders WHERE display_name = 'Joel Jenkins');

  -- 3. Daniel Quijada — brick, 10000 private
  INSERT INTO founders (display_name, business_name, business_url, tier, amount_cents,
                        message, logo_url, payment_provider, payment_ref,
                        is_public, status, position, paid_at)
  SELECT 'Daniel Quijada', NULL, NULL, 'brick', 10000,
         NULL, NULL, NULL, NULL, true, 'approved',
         (SELECT COALESCE(MAX(position),0)+1 FROM founders WHERE tier = 'brick'), now()
  WHERE NOT EXISTS (SELECT 1 FROM founders WHERE display_name = 'Daniel Quijada');

  -- 4. Frederick C. Knapp — steel, 50000 private
  INSERT INTO founders (display_name, business_name, business_url, tier, amount_cents,
                        message, logo_url, payment_provider, payment_ref,
                        is_public, status, position, paid_at)
  SELECT 'Frederick C. Knapp', NULL, NULL, 'steel', 50000,
         NULL, NULL, NULL, NULL, true, 'approved',
         (SELECT COALESCE(MAX(position),0)+1 FROM founders WHERE tier = 'steel'), now()
  WHERE NOT EXISTS (SELECT 1 FROM founders WHERE display_name = 'Frederick C. Knapp');

  SELECT count(*) INTO ins FROM founders;
  IF ins - total_before <> 2 THEN
    RAISE EXCEPTION 'inserted % rows, expected 2 (Daniel + Frederick)', ins - total_before; END IF;

  -- the public campaign total
  UPDATE campaign_settings
     SET raised_cents_override = 1130500, updated_at = now()
   WHERE id = true AND goal_cents = 1155000 AND raised_cents_override = 1070500;
  IF NOT FOUND THEN RAISE EXCEPTION 'campaign_settings UPDATE matched no row'; END IF;

  -- verify before committing
  SELECT founder_count, remaining_cents INTO fc, rem FROM campaign_progress;
  IF fc  <> 31    THEN RAISE EXCEPTION 'founder_count is %, expected 31', fc; END IF;
  IF rem <> 24500 THEN RAISE EXCEPTION 'remaining_cents is %, expected 24500 ($245)', rem; END IF;
  SELECT count(*) INTO n FROM founders
   WHERE display_name IN ('Davis Claudeton','Joel Jenkins','Daniel Quijada','Frederick C. Knapp');
  IF n <> 4 THEN RAISE EXCEPTION 'the four founders resolve to % rows, expected 4', n; END IF;
  SELECT count(*) INTO n FROM founders WHERE payment_provider IS NOT NULL OR payment_ref IS NOT NULL;
  IF n <> 0 THEN RAISE EXCEPTION '% payment references present, expected 0', n; END IF;
END $$;
```

Transaction 1 had the same shape with unconditional `INSERT … VALUES` for the
first two founders, `raised_cents_override` 955,500 → 1,070,500, and pre-commit
assertions of `founder_count = 29` and `remaining_cents = 84500`.

## Privacy model

`amount_cents` is written but never read on the public path:

- `src/lib/community/founders.ts` does not select the column, so per-founder
  amounts cannot reach a page.
- `FounderCard.tsx` and `FoundersWallList.tsx` do not reference it.
- `src/lib/community/campaign.ts` documents the aggregate model: individual
  amounts are NEVER summed to derive the public total.

Nothing in this change altered that, and no component, tier definition, or line
of application code was touched.

## No payment records

`payment_provider` and `payment_ref` are NULL on all four rows. No payment
transaction exists for these contributions and none was invented. Across all 31
founder rows the count of non-null payment references is **0**, which is also
what it was before — the table has never carried one.

## Blast radius

Two tables were written: `founders` (four inserts across the two transactions)
and `campaign_settings` (two updates to `raised_cents_override` / `updated_at`).
No DELETE, no DDL, no permission change.

Verified after the fact by fingerprint — `md5(string_agg(t::text, '|' ORDER BY
t.id))` over the pre-existing rows reproduced the pre-write whole-table
fingerprint byte for byte, and `count(*) WHERE updated_at > <write time>`
excluding the new rows returned 0. No pre-existing founder changed in any
column.

Post-change fingerprints, for future before/after comparison with the same
formula:

| Fingerprint | Value |
|---|---|
| `founders` | `c3ce589b50ea5fcddbbf1d88bd6faef0` |
| `campaign_settings` | `7d9b51a96d8a6ac4daf97141b25cab50` |

## Rollback

Restores the state before any of the four founders. For reference only — this
would remove four people from the wall and should not be run without the owner
saying so.

```sql
-- BEGIN;
--   DELETE FROM founders WHERE display_name IN
--     ('Davis Claudeton','Joel Jenkins','Daniel Quijada','Frederick C. Knapp');
--   UPDATE campaign_settings
--      SET raised_cents_override = 955500, updated_at = now()
--    WHERE id = true;
--   -- expect: founder_count 27, remaining_cents 199500 ($1,995)
-- COMMIT;
```

## Superseded package

`docs/operations/founder-davis-claudeton.sql` was written when only Davis
Claudeton was authorized. It described a single insert taking
`raised_cents_override` to 1,060,500 and the display to "$945", and asserted
`founder_count = 28`. Three more founders were authorized before it was ever
run, so every one of those numbers is now wrong. It was never executed — its own
`WHERE raised_cents_override = 955500` guard and its "Davis Claudeton already
exists" check would both refuse today — and it has been deleted rather than left
in the tree as a package that reads as runnable. Its content is preserved in
git history at commit `16d74d9`, and everything in it that remains true is
carried forward above.
