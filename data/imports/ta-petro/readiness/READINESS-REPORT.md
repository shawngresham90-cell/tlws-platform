# TA/Petro directory-readiness report (read-only analysis)

Produced after the full publication (304/304 live). **This analysis changed no
live data.** It is read-only preparation: findings, an unexecuted `is_indexable`
plan, a national coverage report, a held-work review, and ranked next steps.

Source label: `official-ta-petro-20260725-5ebe0e9f`. Project: `tlws-platform`
(`cgvxwvymkembftznhcdl`).

## 1. Indexability readiness of the 304

### Key architecture finding — the `is_indexable` column is a manual override

`locations.is_indexable` is **false on all 304** (and, per code, on every row in
the table). It is *not* what makes a page indexable:

- **Detail-page robots** (`/directory/location/<slug>`) are set by the
  deterministic gate `isDetailIndexable()` (`src/lib/directory/detail.ts`):
  requires address + city + state + a valid category + **≥2** of {phone,
  website, description ≥30 chars, ≥1 amenity, lat+lng, parking_spaces}.
- **Sitemap** inclusion (`src/app/sitemap.ts:270`) uses the *same* gate.
- The DB `is_indexable` column's only live consumer is the **ItemList JSON-LD**
  on listing pages (`src/lib/directory/seo.ts:120`) — structured data only.

**Consequence:** all 304 rows already pass `isDetailIndexable` (minimum 3
signals, average 4.99; every row has address, phone, ≥1 amenity, and
coordinates). So **the 304 detail pages are already index-eligible and already
in the sitemap** as of publication. Flipping `is_indexable` is optional polish
that only adds them to ItemList structured data; it does not gate search
visibility.

### Per-row completeness (all 304)

| Signal | Rows with it |
|---|--:|
| Name, city, state, valid category | 304 / 304 |
| Coordinates (valid, in range) | 304 / 304 |
| Phone | 304 / 304 |
| Amenities (≥1) | 304 / 304 |
| Description ≥50 chars | 302 / 304 |
| Parking spaces (>0) | 303 / 304 |
| Valid detail-page slug (app contract) | 304 / 304 |
| Website | 0 / 304 |
| Hours | 0 / 304 |
| Image URL | 0 / 304 |
| Interstate / exit number | 0 / 304 |
| `completeness_score` | 0 on all 304 (never computed) |

### The only per-row gaps (3 rows)

| Row | State | Issue |
|---|---|---|
| TA Truck Service Franklin (`ce461491-…`) | KY | description <50 chars **and** no parking count |
| TA Express Brush (`67812e7e-…`) | CO | description <50 chars |

Both still pass the indexability gate (phone + amenities + coordinates = 3
signals), so neither is noindex; these are quality polish, not blockers.

### Duplicate & consistency risk — clean

- 0 duplicate `detail_slug`, 0 duplicate `type|state|city|slug` across the live
  table.
- 0 `(name, city, state)` collisions anywhere; 0 batch rows collide with a
  pre-existing row by name+city+state.
- 0 slug/state mismatches (every `detail_slug` ends with its true state).

## 2. `is_indexable` rollout — prepared, NOT executed

`INDEXABILITY-rollout.sql` and `INDEXABILITY-rollback.sql` (this directory) set /
revert `is_indexable` for the 304, scoped by the exact source label +
`is_published=true`, writing only `is_indexable`, with an exact `ROW_COUNT=304`
guard and auto-rollback. **Neither has been run** — `is_indexable` was outside
this run's authorized scope. Given the finding above, the rollout is low-stakes
(ItemList structured data only) and can wait for a deliberate decision.

## 3. National coverage report

Published directory coverage after this publication (truck-stop directory;
counts are published, non-deleted rows):

- **States with coverage: 43.** Total published directory rows: 1,020
  (716 pre-existing published + 304 TA/Petro).
- **States with NO published coverage (7):** AK, DE, HI, MA, MD, ME, VT.
- **31 states where TA/Petro is now the *only* published source** (previously
  had zero): AZ, CA, CO, CT, IA, ID, KS, LA, MN, MO, MS, MT, ND, NE, NH, NJ, NM,
  NV, NY, OK, OR, PA, RI, SC, SD, UT, VA, WA, WI, WV, WY. The import materially
  widened the map into the Mountain West, Plains, and Pacific.

### Strongest states (published totals)
TN 158, AR 94, IN 88, GA 80, KY 73, FL 72, MI 63, OH 63, AL 54, TX 40, NC 27.

### Weak / thin states (≤5 published, mostly TA/Petro-only)
NH 1, RI 1, ID 2, MT 2, CT 3, NE 3, SD 3, UT 3, MN 4, MS 4, NJ 4, WA 4, WV 4,
VA 5, SC 5, ND 5, WY 5.

### Weakest freight corridors
1. **I-95 Northeast** — the biggest gap: MA, MD, DE, ME, VT have *zero*
   coverage; NH 1, RI 1, CT 3, NJ 4 are thin. High traffic, high driver value.
2. **Northern tier I-90/I-94** — MT 2, ND 5, SD 3, MN 4 thin.
3. **I-80 / I-15 mountain-west** — WY 5, UT 3, NE 3 thin.

### Highest-priority expansion areas
1. Northeast I-95 corridor (fill MA/MD/DE + strengthen NH/RI/CT/NJ).
2. Northern tier (MT/ND/SD/MN) along I-90/I-94.
3. Mountain west (WY/UT/NE) along I-80/I-15.

## 4. Held & excluded records — reviewed, untouched

The whole live table has exactly two sources: `csv-import` (1,252 pre-existing)
and this TA/Petro batch (304). All held/excluded networks live under
`csv-import` and were provably untouched (pre-existing row-digest unchanged
through the entire run):

- **Love's:** 159 rows (122 published), including the single **Love's Florence**
  record — untouched. A prior correction audit exists at
  `docs/directory/loves-420-florence-correction-audit.md`.
- **Sapp Bros:** 1 row — untouched.
- **Pilot / Flying J:** 210 rows — untouched.
- **Goasis / Thorntons:** 0 rows present under those names. The "6 Goasis/
  Thorntons" and "37 manual-review" items from the import context were rows held
  *out* of the TA/Petro import; they never entered the DB, and the batch is
  exactly 304 TA/Petro-brand rows — consistent with 0 held rows inserted.

Nothing here needs action; the note is a confirmation that the excluded set is
absent from the batch and unmodified in the pre-existing set.

## 5. Ranked next-directory-work recommendation

Ranked by driver usefulness × SEO value ÷ effort, with duplicate risk noted.

1. **Populate `interstate` + `exit_number` for the 304** (currently null).
   Medium effort (derivable from coordinates + address). Unlocks the
   `/directory/<interstate>/<exit>` corridor and exit-browse pages — high driver
   usefulness and internal-linking/SEO value. Zero duplicate risk (in-place
   enrichment). *Biggest value-for-effort.*
2. **Authorize the `is_indexable` rollout** (script ready). Trivial effort,
   modest SEO (ItemList structured data). Zero duplicate risk. Detail pages are
   already indexable, so this is polish, not a visibility unlock.
3. **Fix the 2 thin rows** (KY Franklin description + parking, CO Brush
   description). Trivial effort; nudges them from 3→4 signals.
4. **Enrich website + hours across the batch** (0/304 today). Higher effort
   (data sourcing) but both are strong indexability signals and high driver
   value. Do it for the 716 pre-existing published rows too where missing.
5. **Expand the Northeast I-95 corridor** (MA/MD/DE/ME/VT + thicken NH/RI/CT/NJ)
   via the existing guarded import pipeline. Largest effort (sourcing +
   geocoding + import), largest coverage payoff. Watch duplicate risk against
   the 210 Pilot/Flying J and 159 Love's rows already in those states.
6. **Compute `completeness_score`** for the batch (0 on all 304). Low priority —
   ranking does not use it and it is display-only today.

Do **not** start an architecture reorganization; all of the above are additive,
in-place, or new-import work that fits the current schema and pipeline.

## Change-control confirmation

This report and the two SQL files are inert repository text. No live-database
write, migration, schema/trigger/policy change, application deploy, connector
authorization, or secret access occurred while producing this analysis. The only
live writes in the whole run were `is_published false → true` on the 294
authorized rows (Phase 3), already merged as PR #181.
