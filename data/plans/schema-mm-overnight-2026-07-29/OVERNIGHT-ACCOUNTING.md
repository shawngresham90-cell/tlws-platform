# Overnight-status accounting — exact, read-only (2026-07-29)

Grouped over all 2,830 live rows (`deleted_at is null`) by source × current boolean × publication, with parking-space status. Read-only SELECTs only.

## Raw accounting

| Source | overnight_parking | Published | Rows | spaces NULL | spaces = 0 | spaces > 0 |
|---|---|---|---:|---:|---:|---:|
| csv-import | false | false | 324 | 321 | 0 | 3 |
| csv-import | false | true | 598 | 475 | 0 | 123 |
| csv-import | true | false | 24 | 19 | 0 | 5 |
| csv-import | true | true | 306 | 121 | 0 | 185 |
| loves-master-2026-07-27 | false | false | 9 | 0 | 0 | 9 |
| loves-master-2026-07-27 | false | true | 1 | 0 | 1 | 0 |
| loves-master-2026-07-27 | true | true | 541 | 0 | 0 | 541 |
| ntad-2019-v04 | false | false | 5 | 5 | 0 | 0 |
| official-ta-petro-20260725-5ebe0e9f | false | true | 304 | 1 | 0 | 303 |
| pilot-master-2026-07-27 | false | false | 14 | 0 | 14 | 0 |
| pilot-master-2026-07-27 | false | true | 704 | 0 | 0 | 704 |
| **Total** | | | **2,830** | | | |

Cross-checks: true rows = 24 + 306 + 541 = **871**; false rows = **1,959**; published = 598+306+1+541+304+704 = **2,454** ✓.

## Evidence level by source (the provenance the boolean actually has)

| Source | Rows | Overnight evidence in the source | Verdict for backfill |
|---|---:|---|---|
| `loves-master-2026-07-27` | 551 | **Yes** — the official Love's master export carries an explicit overnight-parking field; the 541 `true` rows were flipped one-by-one in the guarded overnight-closeout milestones (PRs #202/#203) against export value `Y`, including #317 Skippers VA. The 10 `false` rows are the quarantined/zero-space records deliberately left unconfirmed. | 541 → **confirmed** (explicit authoritative evidence, row-scoped). 10 → **unknown**. |
| `pilot-master-2026-07-27` | 718 | **No** — the official Pilot export had *no overnight field*. All 718 are `false` because `false` is the column default. | 718 → **unknown**. **Never auto-confirm.** |
| `official-ta-petro-20260725-5ebe0e9f` | 304 | **No** — TA/Petro evidence covered parking-space counts only. Parking-space evidence does not prove overnight permission. | 304 → **unknown**. **Never auto-confirm.** |
| `csv-import` (legacy) | 1,252 | **Mixed/undocumented** — 330 rows carry `true` and 922 carry `false` with no per-row evidence trail in the repository. The `true` values predate the guarded-evidence era. | 922 false → **unknown**. 330 true → **manual review queue** (see below). |
| `ntad-2019-v04` | 5 | **No by design** — the canary insert authorization explicitly stored `overnight_parking = false` as "not confirmed". | 5 → **unknown**. |

## Backfill totals (evidence-based, per the rules)

| Target status | Rows | Rule satisfied |
|---|---:|---|
| `confirmed` | **541** | Explicit authoritative operator evidence (Love's official export overnight = Y, row-verified in merged closeout records) |
| `prohibited` | **0** | No row in the database has documented, explicit, authoritative prohibition evidence today |
| `unknown` (default, no write needed) | **2,289** | Everything else — including all 718 Pilot, all 304 TA, all 922 legacy-false, the 10 unconfirmed Love's, and the 5 NTAD canaries |
| — of which **manual review queue** | **330** | `csv-import` rows with legacy `true`: the boolean *claims* overnight is OK but no per-row evidence exists in the repo. They stay `unknown` in the status column until each is either re-evidenced (→ confirmed) or corrected. Manifest query below. |

Manual-review manifest query (read-only):
```sql
select id, name, state, city, is_published, parking_spaces
from locations
where deleted_at is null and source = 'csv-import' and overnight_parking = true
order by state, city, name;  -- expected 330 rows (306 published, 24 unpublished)
```

## The posted-time-limit rule (documented, per instruction)

A posted time limit at a rest area or lot **does not by itself mean overnight parking is prohibited.** Many states post 2–4-hour limits yet explicitly exempt or tolerate commercial drivers taking federally required HOS rest; others enforce strictly. The rule for this platform:

- `prohibited` may be recorded **only** from explicit prohibition language in an authoritative source — state DOT policy page, state administrative code, or posted-regulation text captured in evidence — that says overnight parking (or parking beyond the limit for rest) is not permitted.
- A posted time limit alone is recorded in the listing `description`, and `overnight_status` stays `unknown` until state-rule evidence is gathered.
- Never infer status from facility name, category (e.g., "rest area"), operator cadence, or parking count.

## The one user-visible trade-off (owner decision required at execution time)

Today `toEntry()` renders `overnight_parking = true` as the "Overnight OK" chip → "Overnight confirmed" in the corridor UI. 306 published `csv-import` rows currently display that claim without a per-row evidence trail. When read paths switch to `overnight_status`:

- **Option A (recommended, most honest):** those 306 rows display "Overnight unknown" until manually re-evidenced. Removes an unverified claim from production; the review manifest makes re-confirmation incremental.
- **Option B:** hold the read-path switchover until the 330-row manual review completes, so no published row visibly downgrades. Honesty cost: the legacy claim keeps displaying during the review window.

The execution authorization must pick A or B; the migration itself is identical either way (the choice only affects when the code switchover milestone ships).
