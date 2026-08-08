# Execution blueprint — coordinate recovery for 65 driver-useful parking rows

**PLANNING DOCUMENT. Nothing here has been executed. No production data was
written to produce it — every query behind it was a `SELECT`.**

Goal: bring published parking locations that already state a positive parking
count, but have no coordinates, into the Trip Planner — without inventing
anything and without relaxing a single existing rule.

This blueprint is written so it can be executed later in guarded batches by
someone who was not present for the audit.

---

## 1. Exact candidate list

79 published rows have `parking_spaces > 0` and no coordinates. Applying this
authorization's own exclusions **as a classification rather than a filter**, so
nothing is silently dropped:

| Tier | Rows | Spaces | Meaning |
|---|---|---|---|
| **A** | **62** | 2,674 | Street address **and** ZIP present — geocodable as-is |
| **B** | **2** | 24 | Street address, **no ZIP** — needs city/state fallback, lower confidence |
| **BLOCKED** | **1** | 33 | No address at all — cannot be geocoded from an address |
| ~~X-op~~ | 8 | 1,035 | Love's / Pilot / Flying J / ONE9 / TA / Petro — completed operator work |
| ~~X-cat~~ | 6 | 662 | CAT Scale category — prohibited |
| **Total** | **79** | 5,028 | |

**Executable set = 64 rows (62 Tier A + 2 Tier B).**

### Tier A — 62 rows

`id8` is the first 8 characters of the row UUID, enough to key a manifest
without pasting full IDs into a document.

| # | id8 | State | City | Name | Address | ZIP | Route | Spaces | Category |
|---|---|---|---|---|---|---|---|---|---|
| 1 | cb524d9b | AL | Atmore | Creek Travel Plaza (Creek Travel Stores - Poarch) | 4740 Jack Springs Rd | 36502 | I-65 / 54 | 88 | truck-stops |
| 2 | 02cc4878 | AL | Evergreen | Spirit Travel Center | 192 Highway 83 | 36401 | I-65 / 96 | 50 | truck-stops |
| 3 | c82e72bd | AL | Jemison | Jemison Exxon | 12820 County Road 42 | 35085 | I-65 / 219 | 50 | truck-stops |
| 4 | 0d9f969f | AR | Brinkley | Road Ranger Travel Center | 2202 N Main St | 72021 | I-40 / 216 | 81 | truck-stops |
| 5 | 13a9285c | AR | Carlisle | Conoco Truck Stop (Carlisle One Stop) | 1491 Bobby L Glover Highway | 72024 | I-40 / 183 | 19 | truck-stops |
| 6 | 6b64ef96 | AR | Clarksville | Sunset Inn Clarksville | 2600 W Main St | 72830 | I-40 / 55 | 10 | hotels-truck-parking |
| 7 | 50a29c91 | AR | Hazen | T Ricks Travel Center | 4350 Highway 63 N | 72064 | I-40 / 193 | 25 | truck-stops |
| 8 | 3029ff4b | AR | Heth | Mapco Express #3155 | 202 Highway 75 N | 72346 | I-40 / 256 | 15 | truck-stops |
| 9 | 9fb45fb9 | AR | Lonoke | Circle K (Valero) - Lonoke | 1954 Highway 31 N | 72086 | I-40 / 175 | 28 | truck-stops |
| 10 | 6cb96913 | AR | Mulberry | Kountry Xpress Truck Stop | 1107 Georgia Ridge Dr | 72947 | I-40 / 20 | 20 | truck-stops |
| 11 | a1bc2913 | AR | Ozark | Workman's Travel Center - Ozark | 3202 Pence Lane | 72949 | I-40 / 35 | 80 | truck-stops |
| 12 | 214dc102 | AR | Wheatley | Pit Stop Diner | 1073 Highway 78 N | 72392 | I-40 / 221 | 20 | truck-stops |
| 13 | efd90b77 | FL | Ellenton | Super 8 by Wyndham Ellenton Bradenton Area | 5218 17th St E | 34222 | I-75 / 224 | 5 | hotels-truck-parking |
| 14 | 54d2b882 | GA | Adairsville | QuikTrip Travel Center #757 | 961 Hwy 140 NW | 30103 | I-75 / 306 | 25 | truck-stops |
| 15 | a66959e8 | GA | Forsyth | Rumble Road BP | 1334 Rumble Rd | 31029 | I-75 / 181 | 10 | truck-stops |
| 16 | d80ff428 | GA | Hahira | Big Foot Travel Center | 1311 Hwy 122 W | 31632 | I-75 / 29 | 55 | truck-stops |
| 17 | dfc83f1a | GA | Ringgold | Circle K (Ringgold Travel Center) | 11418 Hwy 41 | 30736 | I-75 / 345 | 50 | truck-stops |
| 18 | b6d01963 | IL | Metropolis | Metropolis Truck Plaza | 2105 E 5th St | 62960 | I-24 / 37 | 15 | truck-stops |
| 19 | 18b7f760 | IN | Austin | Fuel Mart #783 | 145 N Dowling St | 47102 | I-65 / 34 | 30 | truck-stops |
| 20 | 03ed38e8 | IN | Crothersville | Uniontown Fuel Stop | 11786 E State Road 250 | 47274 | I-65 / 41 | 50 | truck-stops |
| 21 | **faa5e68a** | IN | Henryville | **Henryville Rest Area (Southbound)** | 21505 S I-65 | 47126 | I-65 / — | 64 | **parking** |
| 22 | c1ef60d0 | IN | Lafayette | Circle K #2408 | 6533 State Road 38 E | 47905 | I-65 / 168 | 8 | truck-stops |
| 23 | 0b661f90 | IN | Remington | Crazy D's | 13550 S US 231 | 47977 | I-65 / 205 | 60 | truck-stops |
| 24 | 2b918267 | KY | Berea | 76 Fuel Center | 104 N Dogwood Dr | 40403 | I-75 / 76 | 57 | truck-stops |
| 25 | 1b26d26d | KY | Corbin | Super 8 by Wyndham Corbin/London KY | 171 W Cumberland Gap Pkwy | 40701 | I-75 / 29 | 5 | hotels-truck-parking |
| 26 | b23b7bb8 | KY | Corinth | Noble's Restaurant and Truck Stop | 1065 Owenton Rd | 41010 | I-75 / 144 | 75 | truck-stops |
| 27 | c43fdbd0 | KY | East Bernstadt | 49er Fuel Center | 707 KY-909 (Hwy 909) | 40729 | I-75 / 49 | 40 | truck-stops |
| 28 | c1566ed5 | KY | London | Exit 38 Truck Plaza (Shell) | 1024 Highway 192 (192 Bypass) | 40741 | I-75 / 38 | 50 | truck-stops |
| 29 | a8c4f2d2 | KY | London | London Travel Plaza (AMBEST) | 15 Dogpatch Trading Center | 40741 | I-75 / 41 | 100 | truck-stops |
| 30 | 3e0cd409 | KY | Mount Vernon | Derby City South Truck Plaza | 1990 Richmond St (US-25) | 40456 | I-75 / 62 | 200 | truck-stops |
| 31 | 943d41c1 | KY | Mount Vernon | Mount Vernon Fuel Center | 2480 S Wilderness Rd (US-25) | 40456 | I-75 / 59 | 15 | truck-stops |
| 32 | 1de92b6e | KY | Richmond | Dishman's Shell Food Mart | 3198 Lexington Rd | 40475 | I-75 / 95 | 10 | truck-stops |
| 33 | e170da26 | MI | Bay City | Fast Pax Food Store (Bay City) | 5099 S Mackinaw Rd | 48706 | I-75 / 162 | 20 | truck-stops |
| 34 | c043c657 | MI | Birch Run | Birch Run Express Travel Center | 8830 Main St | 48415 | I-75 / 136 | 7 | truck-stops |
| 35 | 9fc4690a | MI | Birch Run | Conlee Travel Center - Birch Run | 9180 E Birch Run Rd | 48415 | I-75 / 136 | 5 | truck-stops |
| 36 | e1e61d3d | MI | Bridgeport | Speedway #8723 | 6595 Dixie Hwy | 48722 | I-75 / 144A | 25 | truck-stops |
| 37 | f43b9f5a | MI | Grayling | Charlie's Country Corner (Fick & Sons) | 5800 Nelson A Miles Pkwy | 49738 | I-75 / 251 | 80 | truck-stops |
| 38 | 883306d0 | MI | Mount Morris | BP Fuel Stop - Mt Morris | 4313 W Mount Morris Rd | 48458 | I-75 / 126 | 15 | truck-stops |
| 39 | 72a21b70 | MI | Sault Ste. Marie | Admiral — Sault Ste. Marie | 4135 I-75 Business Spur | 49783 | I-75 / — | 8 | truck-stops |
| 40 | 29fb50b8 | MI | Sault Ste. Marie | Holiday Stationstore — W Portage Ave | 942 W Portage Ave | 49783 | I-75 / 394 | 5 | truck-stops |
| 41 | b02dc944 | MI | St. Ignace | St. Ignace Truck Stop (BP) | 917 US-2 W | 49781 | I-75 / 344 | 20 | truck-stops |
| 42 | d77a0666 | NC | Nebo | Nebo Truck Stop | 31 Lawing Dr | 28761 | I-40 / 90 | 15 | truck-stops |
| 43 | c0d803ff | OH | Anna | 99 Truck Stop (Joe's Stop 99) | 14575 OH-119 | 45302 | I-75 / 99 | 48 | truck-stops |
| 44 | 6b1c4dcd | OH | Anna | Anna Truck Stop | 14262 SR-119 (OH-119) | 45302 | I-75 / 99 | 250 | truck-stops |
| 45 | 5a49d5db | OH | Beaverdam | Speedway #3547 | 7837 East Lincoln Highway | 45808 | I-75 / 135 | 43 | truck-stops |
| 46 | 8043b977 | OH | Cridersville | Fuel Mart #782 | 101 South Dixie Highway | 45806 | I-75 / 118 | 5 | truck-stops |
| 47 | ca53a744 | OH | Findlay | Speedway | 3730 Speedway Drive | 45840 | I-75 / 161 | 48 | truck-stops |
| 48 | 2a63ae26 | OH | Lima | Shawnee Fuel Stop | 1250 West Breese Road | 45806 | I-75 / 120 | 15 | truck-stops |
| 49 | 6e547c77 | TN | Brownsville | Bells Truck Stop | 9730 US Highway 70 | 38006 | I-40 / 66 | 45 | truck-stops |
| 50 | bd85fd98 | TN | Brownsville | Comfort Inn Brownsville I-40 | 120 Sunny Hill Cove | 38012 | I-40 / 56 | 5 | hotels-truck-parking |
| 51 | 277f07bd | TN | Cedar Grove | 101 Travel Center | 7311 Highway 104 N | 38321 | I-40 / 101 | 100 | truck-stops |
| 52 | 22e3b5de | TN | Chattanooga | Speedway #7115 | 7420 Bonny Oaks Dr | 37421 | I-75 / 7 | 7 | truck-stops |
| 53 | 4afcec75 | TN | Cornersville | Dolly's Tennessean Travel Stop | 3686 Pulaski Highway | 37047 | I-65 / 22 | 100 | truck-stops |
| 54 | 45dba33a | TN | Cross Plains | MAPCO Express #1028 | 8631 Highway 25 E | 37049 | I-65 / 112 | 30 | truck-stops |
| 55 | 94bc004a | TN | Crossville | Eco Travel Plaza (Roady's) | 1897 Genesis Rd | 38555 | I-40 / 320 | 60 | truck-stops |
| 56 | 9ecc9414 | TN | Crossville | I-40 Truck Park (Truck & RV Parking) | 2611 Genesis Rd | 38571 | I-40 / 320 | 20 | parking |
| 57 | d500643d | TN | Elkton | Shady Lawn Truck Stop | 1371 Bryson Road | 38449 | I-65 / 6 | 42 | truck-stops |
| 58 | df94342a | TN | Goodlettsville | Park City Truck Park (Truck Parking Club) | 7409 Cycle Lane | 37072 | I-65 / — | 30 | parking |
| 59 | 34eeab35 | TN | Holladay | Holladay Shell (Holiday Shell) | 13781 Highway 641 N | 38341 | I-40 / 126 | 46 | tire-repair |
| 60 | 5fe49a55 | TN | Mason | Longtown Travel Plaza (BP) & Cafe | 3965 Highway 59 | 38049 | I-40 / 35 | 60 | truck-stops |
| 61 | 523080e8 | TN | Newport | Newport Truck and Trailer Repair - Fleet Parking | 116 Jasmine Dr | 37821 | I-40 / — | 100 | parking |
| 62 | a72cd51e | TN | Newport | Weigel's #80 | 910 Cosby Hwy | 37821 | I-40 / 435 | 10 | truck-stops |

### Tier B — 2 rows (no ZIP)

| id8 | State | City | Name | Address | Route | Spaces |
|---|---|---|---|---|---|---|
| b9e80538 | MI | Holly | Alex's Market & Grill | 6410 Grange Hall Rd | I-75 / 101 | 20 |
| 289a8cee | TN | Cookeville | Truck Parking Club - Cookeville | 1602 Salem Rd | I-40 / 288 | 4 |

### BLOCKED — 1 row

| id8 | State | City | Name | Why |
|---|---|---|---|---|
| 148c8e61 | MI | Bay City | I-75 Bay City Rest Area (Southbound) | `address` and `zip` both NULL. Nothing to geocode. Also a rest area — see §12 R1. |

### ⚠ Two rest areas are inside the candidate set

Rows **21** (Henryville Rest Area, IN) and the BLOCKED row (Bay City Rest Area,
MI) are public rest areas. Both are **already published** — geocoding them is
not "publishing a rest area" in the literal sense, but it would materially
increase their driver-facing reach by admitting them to the Trip Planner.

**Neither may be executed under the current authorization.** They are carved
out into their own batch (§10, Batch R) that stays parked until you say
otherwise. Executable set net of these: **63 rows** (61 Tier A + 2 Tier B).

### Finding: no candidate can be resolved from internal evidence

Checked whether any candidate shares an address with a row that already has
coordinates — which would make the coordinate internal corroboration rather
than a new external claim. **Six matches, and all six are already-excluded CAT
Scale or operator rows.** Zero Tier A or Tier B candidates have a
coordinate-bearing sibling.

There is no "free" subset. Every one of the 63 requires an external
authoritative geocode. This is why §5 has no shortcut.

---

## 2. State breakdown

| State | Tier A | Tier B | Blocked | Total | Spaces | Corridor |
|---|---|---|---|---|---|---|
| TN | 14 | 1 | 0 | **15** | 659 | I-40, I-65, I-75 |
| MI | 9 | 1 | 1 | **11** | 238 | I-75 |
| AR | 9 | 0 | 0 | **9** | 298 | I-40 |
| KY | 9 | 0 | 0 | **9** | 552 | I-75 |
| OH | 6 | 0 | 0 | **6** | 409 | I-75 |
| IN | 5 | 0 | 0 | **5** | 212 | I-65 |
| GA | 4 | 0 | 0 | **4** | 140 | I-75 |
| AL | 3 | 0 | 0 | **3** | 188 | I-65 |
| FL | 1 | 0 | 0 | **1** | 5 | I-75 |
| IL | 1 | 0 | 0 | **1** | 15 | I-24 |
| NC | 1 | 0 | 0 | **1** | 15 | I-40 |
| **Total** | **62** | **2** | **1** | **65** | **2,731** | |

Eleven states, three corridors. This is the original CSV corridor import — the
same footprint the audit found the coordinate gap concentrated in.

---

## 3. Priority order

Ordered by **driver value per unit of risk**, not by row count.

| Pass | Scope | Rows | Rationale |
|---|---|---|---|
| **P0** | Canary: 5 rows, mixed states (§10) | 5 | Prove the pipeline before volume |
| **P1** | KY + OH — I-75 spine, high spaces/row | 15 | 961 spaces; densest value; simple street addresses |
| **P2** | TN (Tier A only) | 14 | Largest state block; most driver traffic |
| **P3** | AR + IN | 14 | I-40 / I-65; clean rural addresses |
| **P4** | MI (Tier A only) | 9 | I-75 north; two Sault Ste. Marie rows need route review (§12 R4) |
| **P5** | AL + GA + FL + IL + NC | 10 | Long tail, one to four rows each |
| **P6** | Tier B (2 rows) | 2 | No ZIP — lower confidence, handled last and separately |
| **Batch R** | Rest areas | 2 | **HELD — requires separate authorization** |

Canary rows are drawn from P1/P2 and are not re-counted in those passes.

---

## 4. Estimated Trip Planner gain

Current: **1,777** parking-eligible of **1,856** driver-useful (95.7 %).

| Scenario | Geocode success | Rows added | Parking-eligible | Gain |
|---|---|---|---|---|
| All 63 succeed (ceiling) | 100 % | +63 | 1,840 | **+3.5 %** |
| Realistic | ~90 % | +57 | 1,834 | **+3.2 %** |
| Conservative | ~75 % | +47 | 1,824 | **+2.6 %** |
| Including the 2 held rest areas | 100 % | +65 | 1,842 | +3.7 % |

Planner **pool** (all published + geocoded rows, parking or not) moves
1,940 → ~1,997.

Absolute ceiling for this queue is 1,856 — every remaining driver-useful row
would then be planner-visible. The 16-row gap to that ceiling is the excluded
CAT Scale and operator rows, which is a separate decision, not a shortfall of
this plan.

**Realistic expectation: ~+57 locations, +3.2 %.** Modest by design. The value
is that each one is a genuinely parkable location a driver currently cannot be
routed to, recovered without inventing anything.

---

## 5. Evidence source required, per state

**Primary source, all 11 states: U.S. Census Bureau Geocoder**
(`geocoding.geo.census.gov`, `benchmark=Public_AR_Current`) — public, keyless,
authoritative for street addresses, and already this project's calibrated
source for prior geocoding passes. Using it keeps this batch comparable to the
310 rows already carrying `geocode_source = 'batch-csv'`.

One national source is correct here because **every Tier A/B row is a street
address at a commercial business**. No state-specific authority is needed to
locate a street address.

State DOT evidence becomes required only for the row classes this plan
deliberately excludes:

| Row class | Required source | Status |
|---|---|---|
| Tier A/B commercial addresses (all 11 states) | Census Geocoder | Ready |
| Rest areas (IN 1, MI 1) | INDOT / MDOT facility data | **Held — §10 Batch R** |
| Rows whose exit number is unverified | State DOT exit listing | Out of scope — this plan writes **no** exit values |
| Overnight status | Operator export or statute | Out of scope — this plan writes **no** overnight values |

**This plan changes coordinates only.** It does not touch `exit_number`,
`interstate`, `overnight_status`, `parking_spaces`, `mile_marker`, or
`is_published`. That single-column scope is what makes it safe to batch.

If Census returns no match for a row, the escalation is **state DOT or the
operator's own published address** — never an aggregator (Allstays,
Roadtrippers, Yelp, Trucker Path). Aggregators rank below existing legacy data
and may not promote a row to verified.

---

## 6. Required verification workflow

Per row, in order. Any step failing sends the row to quarantine, not to a
lower standard.

1. **Read** `id, name, address, city, state, zip` from production.
2. **Query Census** with the one-line address. Record the raw response.
3. **Accept only an exact-match tier.** Census `Match` must be a street-address
   match. A ZIP-centroid or city-centroid fallback is **rejected** — a
   centroid is not a location, and writing one would be inventing a coordinate
   with a plausible-looking value, which is worse than leaving NULL.
4. **State containment check.** Returned coordinate must fall within the row's
   stated state. Reuses the audit's §3.2 method (ZIP-3 prefix agreement learned
   from the database itself). Mismatch → quarantine.
5. **Corridor sanity check.** For rows with an `interstate` value, the
   coordinate must lie within ~10 miles of that corridor. This is a
   *plausibility* check only — it never edits the corridor and never derives a
   mile marker. Failure → quarantine for human review, not auto-correction.
6. **Duplicate-collision check.** Compare against every existing coordinate
   (§7). A collision within ~50 m of a *different* address → quarantine.
7. **Human review** of the assembled batch manifest before any write.
8. **Write** in a guarded transaction (§14), stamping provenance.
9. **Post-write verification** — counts, fingerprints, planner-pool delta.

### Provenance stamped on every written row

Reusing the existing vocabulary rather than inventing new values:

| Column | Value | Note |
|---|---|---|
| `lat`, `lng` | Census result | |
| `geocode_source` | `census-2026-08` | New dated value, matching the `loves-master-2026-07-27` convention |
| `coord_verification_status` | `machine-checked` | Existing value (310 rows) |
| `geocode_confidence` | `high` | Existing value; only exact matches are written, so only `high` applies |
| `last_geocoded_at` | `now()` | |

This closes the audit's §3.7 provenance gap for all new work instead of
repeating it — every row this batch touches becomes auditable, which the
existing 1,623 unstamped rows are not.

---

## 7. Duplicate handling

Geocoding is when duplicates surface, because two records for one facility
resolve to one point. Three pairs in this set need adjudication:

| Pair | Risk | Rule |
|---|---|---|
| **Anna, OH** — "99 Truck Stop (Joe's Stop 99)" 14575 OH-119 (48 sp) vs "Anna Truck Stop" 14262 SR-119 (250 sp) | **HIGH.** Same city, same exit 99, same highway, ~300 street numbers apart | If the two coordinates land within ~100 m, **stop and quarantine both**. Do not merge, do not pick a winner. Two records with wildly different space counts (48 vs 250) resolving to one point is unresolved evidence, not a duplicate to clean up |
| **Crossville, TN** — Eco Travel Plaza 1897 Genesis Rd vs I-40 Truck Park 2611 Genesis Rd | MEDIUM. Same road, same exit, different categories | Distinct ZIPs (38555 / 38571) suggest genuinely different sites. Proceed; apply the 50 m collision rule |
| **Birch Run, MI** — Birch Run Express 8830 Main St vs Conlee 9180 E Birch Run Rd | LOW. Same exit, different roads | Proceed; apply the 50 m collision rule |

Standing rules:

- **Never delete a row as a duplicate in this phase.** This phase writes
  coordinates. Deduplication is a separate, separately-authorized decision.
- A new coordinate within 50 m of an existing coordinate at a **different**
  address → quarantine the new row and log the pair.
- Co-located rows sharing one address across categories are **legitimate** and
  must not be collapsed — established in the audit (§3.4). If a candidate
  shares an address with a coordinate-bearing sibling, reusing that
  sibling's coordinate is acceptable and is *internal corroboration*, not a new
  claim. **No Tier A/B candidate qualifies today** (§1), so this path is
  currently unused.
- The four known coordinate collisions from the audit (§3.6) are **not**
  resolved by this phase. They can be adjudicated in the same session since the
  same geocoder answers both, but that is a separate work item.

---

## 8. Rollback strategy

Rollback is unusually clean here because the write is **additive to NULL**.

- Every target row currently has `lat IS NULL AND lng IS NULL`. Rollback is
  therefore setting them back to NULL — no prior value can be lost, because
  there is no prior value.
- Guards write **only** where `lat IS NULL AND lng IS NULL`, so a re-run cannot
  overwrite a coordinate written by anyone else.
- Per-batch rollback keyed on the exact provenance stamp:

```sql
-- ROLLBACK for one batch. Scoped by the dated source stamp, so it can only
-- ever revert rows THIS batch wrote.
-- UPDATE locations
--    SET lat = NULL, lng = NULL,
--        geocode_source = NULL, coord_verification_status = NULL,
--        geocode_confidence = NULL, last_geocoded_at = NULL
--  WHERE geocode_source = 'census-2026-08'
--    AND id = ANY($1::uuid[]);   -- the batch's own id list
```

- Capture `md5(string_agg(...))` fingerprints of the affected rows before and
  after every batch, using the formula pinned in the audit.
- No batch may touch `is_published`, so **no rollback can ever un-publish a
  location** — a location visible to drivers today stays visible even if every
  coordinate is reverted.
- Rollback restores the pre-batch state exactly: those rows return to being
  published, driver-useful, and planner-invisible. That is a return to today's
  behavior, not a degradation.

---

## 9. Batch sizes

| Batch type | Size | Why |
|---|---|---|
| Canary | **5 rows** | Small enough to inspect every row by hand |
| Standard | **one state per transaction, max 15 rows** | A state is a natural evidence boundary; 15 caps blast radius |
| Tier B | **2 rows, together, last** | Lower confidence deserves isolation |
| Rest areas | **2 rows, held** | Requires separate authorization |

One transaction per state. No transaction spans states — matching the
established practice from the prior geocode and publication passes, so a
failure is always attributable to one state's evidence.

Largest single transaction under this plan: **TN, 14 rows.**

---

## 10. Canary strategy

**Canary = 5 rows, chosen for diversity, not convenience.** The point is to
exercise every failure mode before volume.

| id8 | Row | Why this one |
|---|---|---|
| 3e0cd409 | Derby City South Truck Plaza, Mount Vernon KY (200 sp) | Highest-value independent row; address has a parenthetical `(US-25)` that tests address normalization |
| 6b1c4dcd | Anna Truck Stop, Anna OH (250 sp) | Half of the HIGH-risk duplicate pair — tests the collision rule on the case most likely to trip it |
| 34eeab35 | Holladay Shell, Holladay TN (46 sp) | `tire-repair` category with parking — tests that category does not affect coordinate logic |
| d77a0666 | Nebo Truck Stop, Nebo NC (15 sp) | Only NC row; short rural address, a common Census miss |
| 29fb50b8 | Holiday Stationstore, Sault Ste. Marie MI (5 sp) | Far-north edge of the footprint; tests the state-containment check where a bad result would land in Canada |

**Canary gate — all five must hold before any further batch:**

1. All 5 return exact street-address matches (no centroid fallbacks).
2. All 5 coordinates fall inside their stated state.
3. All 5 pass the corridor plausibility check, or are quarantined with a reason.
4. The Anna OH pair does **not** collapse to one point. If it does → stop the
   whole plan, adjudicate, re-plan.
5. Planner pool increases by exactly the number written — no more, no less.
6. Fingerprints show **no** row changed other than the ones written.
7. Zero rows changed `is_published`, `parking_spaces`, `overnight_status`,
   `interstate`, `exit_number`, or `mile_marker`.

If any gate fails, execution stops and the batch is rolled back. A canary that
"mostly worked" is a failed canary.

---

## 11. Estimated time

| Phase | Estimate |
|---|---|
| Pre-flight (fingerprints, manifest, guarded package, tests) | 1.5–2 h |
| Canary (5 rows: geocode, review, write, verify) | 45 min |
| P1–P5 (56 rows, 10 state transactions, review between each) | 4–5 h |
| P6 Tier B (2 rows) | 20 min |
| Final audit, documentation, PR | 1–1.5 h |
| **Total** | **8–10 h** — one working session |

Dominated by human review, not machine time: 63 Census calls take under a
minute. Deliberately not compressed — review between state transactions is the
control that makes the batching meaningful.

Add ~1 h if the Anna OH pair collapses and needs adjudication.

---

## 12. Risks

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| **R1** | **Rest-area scope creep** — geocoding an already-published rest area admits it to the Trip Planner, which is arguably "publishing" it | Certain if not handled | **High** — breaks a standing rule | Both rows carved into held Batch R. Not executed without separate authorization |
| **R2** | Census returns a **ZIP/city centroid** and it is accepted as a location | Medium | **High** — a plausible-looking invented coordinate, worse than NULL | Exact-match tier only; centroid is a hard reject, not a fallback |
| **R3** | **Anna OH pair is one facility**, and geocoding creates two planner entries for one lot | Medium | Medium — driver routed to a stop that may not exist | Canary gate 4; both quarantined on collapse |
| **R4** | **Sault Ste. Marie rows** reference "I-75 Business Spur", not mainline I-75; one has no exit | Medium | Low | Coordinates are still correct for the address. Corridor field untouched. Flag for a later corridor review |
| **R5** | A coordinate lands in the wrong state (e.g. MI row across the Canadian border) | Low | High | State-containment check, in the canary by design |
| **R6** | Egress to Census is granted but rate-limited or flaky mid-batch | Medium | Low | 63 calls is trivial volume; retry with backoff; a failed call quarantines its row rather than guessing |
| **R7** | Batch overwrites a coordinate someone else wrote concurrently | Very low | Medium | Every write guarded on `lat IS NULL AND lng IS NULL` |
| **R8** | Tier B rows (no ZIP) geocode to the wrong "Salem Rd" / "Grange Hall Rd" | Medium | Medium | Isolated to last batch; require exact match plus state containment; quarantine on ambiguity |
| **R9** | Recovered rows have `overnight_status = 'unknown'`, and planner visibility is misread as an overnight endorsement | Low | Medium | Unchanged by this plan — unknown still displays "Overnight unknown" everywhere. Explicitly **do not** touch overnight fields |
| **R10** | Effort is judged against the +3.2 % number and called not worth it | — | — | Stated plainly up front (§4). The value is 57 genuinely parkable locations a driver cannot currently be routed to, recovered at zero cost to accuracy |

---

## 13. Success criteria

A batch succeeds only if **all** hold:

1. Every written coordinate came from an exact street-address match at an
   authoritative source. Zero centroids, zero aggregators, zero inferences.
2. Every written row carries full provenance: `geocode_source`,
   `coord_verification_status`, `geocode_confidence`, `last_geocoded_at`.
3. Every written coordinate falls within its row's stated state.
4. No row outside the batch changed — proven by fingerprint, not asserted.
5. No column outside the five in §6 changed anywhere. Specifically
   `is_published`, `parking_spaces`, `overnight_status`, `interstate`,
   `exit_number` and `mile_marker` are byte-identical before and after.
6. Planner pool grows by exactly the number of rows written.
7. Rows failing any check are quarantined **with a recorded reason** and left
   at `lat IS NULL` — never written with a degraded value.
8. `npm test` passes; the directory and trip-planner harnesses are unchanged.
9. The count of rows whose coordinates lack provenance does not increase.

**Phase success:** ≥ 50 of 63 rows recovered to this standard. Fewer than 50 is
not a failure of the plan — it means the evidence was not there, which is the
correct outcome to report rather than engineer around.

**Explicit non-goals:** hitting 63. Publishing anything new. Improving
route-usability. Resolving the capacity double-count. Each is separate work.

---

## 14. SQL that would eventually be required

> **DOCUMENTATION ONLY — NOT EXECUTABLE.**
> Presented as commented pseudo-SQL so it cannot be pasted and run by accident.
> The real package would be generated per batch from the reviewed manifest,
> with literal values, and reviewed before execution.

```sql
-- ============================================================
-- PER-STATE BATCH — shape only. One transaction per state.
-- ============================================================
--
-- DO $$
-- DECLARE
--   before_pool int; after_pool int; touched int;
--   fp_before text; fp_after text;
-- BEGIN
--   -- ---- Guard 1: the planner pool before the write -------------------
--   SELECT count(*) INTO before_pool FROM locations
--    WHERE deleted_at IS NULL AND is_published
--      AND lat IS NOT NULL AND lng IS NOT NULL;
--
--   -- ---- Guard 2: fingerprint of every row this batch may touch -------
--   SELECT md5(string_agg(t::text, '|' ORDER BY t.id)) INTO fp_before
--     FROM locations t WHERE t.id = ANY(<BATCH_IDS>::uuid[]);
--
--   -- ---- Guard 3: refuse if any target already has a coordinate -------
--   IF EXISTS (SELECT 1 FROM locations
--               WHERE id = ANY(<BATCH_IDS>::uuid[])
--                 AND (lat IS NOT NULL OR lng IS NOT NULL)) THEN
--     RAISE EXCEPTION 'a target row already has coordinates - batch stale';
--   END IF;
--
--   -- ---- Guard 4: refuse if any target is not in the expected state ---
--   IF EXISTS (SELECT 1 FROM locations
--               WHERE id = ANY(<BATCH_IDS>::uuid[])
--                 AND state <> '<STATE>') THEN
--     RAISE EXCEPTION 'batch spans more than one state';
--   END IF;
--
--   -- ---- The write: coordinates + provenance, nothing else ------------
--   -- One statement per row, values from the REVIEWED manifest.
--   -- The lat IS NULL guard makes each write idempotent and makes it
--   -- impossible to overwrite a concurrent write.
--   --
--   -- UPDATE locations
--   --    SET lat = <LAT>, lng = <LNG>,
--   --        geocode_source = 'census-2026-08',
--   --        coord_verification_status = 'machine-checked',
--   --        geocode_confidence = 'high',
--   --        last_geocoded_at = now(),
--   --        updated_at = now()
--   --  WHERE id = '<UUID>'::uuid
--   --    AND lat IS NULL AND lng IS NULL      -- additive-to-NULL only
--   --    AND state = '<STATE>'                -- belt and braces
--   --    AND is_published;                    -- never resurrect a draft
--
--   -- ---- Verify BEFORE commit -----------------------------------------
--   SELECT count(*) INTO touched FROM locations
--    WHERE geocode_source = 'census-2026-08'
--      AND id = ANY(<BATCH_IDS>::uuid[]);
--   IF touched <> <EXPECTED_N> THEN
--     RAISE EXCEPTION 'wrote % rows, expected %', touched, <EXPECTED_N>;
--   END IF;
--
--   SELECT count(*) INTO after_pool FROM locations
--    WHERE deleted_at IS NULL AND is_published
--      AND lat IS NOT NULL AND lng IS NOT NULL;
--   IF after_pool - before_pool <> <EXPECTED_N> THEN
--     RAISE EXCEPTION 'planner pool moved by %, expected %',
--                     after_pool - before_pool, <EXPECTED_N>;
--   END IF;
--
--   -- ---- Nothing outside coordinates + provenance may have changed ----
--   IF EXISTS (
--     SELECT 1 FROM locations
--      WHERE id = ANY(<BATCH_IDS>::uuid[])
--        AND (NOT is_published
--          OR parking_spaces IS DISTINCT FROM <EXPECTED_SPACES>
--          OR overnight_status <> 'unknown'
--          OR mile_marker IS NOT NULL)
--   ) THEN
--     RAISE EXCEPTION 'a protected column changed - aborting';
--   END IF;
-- END $$;
--
-- ============================================================
-- POST-BATCH AUDIT (read-only)
-- ============================================================
-- SELECT count(*) FILTER (WHERE geocode_source = 'census-2026-08') AS written,
--        count(*) FILTER (WHERE lat IS NOT NULL
--                           AND coord_verification_status IS NULL) AS unstamped,
--        md5(string_agg(t::text, '|' ORDER BY t.id))               AS fp_after
--   FROM locations t;
--
-- -- Must hold: `unstamped` did not increase (audit §3.7 does not worsen).
-- -- Must hold: rows outside the batch fingerprint byte-identical.
```

Note there is **no `INSERT`** anywhere in this plan. Every statement is an
`UPDATE` of two coordinate columns plus provenance on a row that already
exists and is already published. That is the narrowest possible write shape
for this objective.

---

## 15. Exact stopping conditions

Stop immediately, roll back the open batch, and report — do not "work around":

1. **Census returns anything other than an exact street-address match** for a
   row → quarantine that row. If **> 20 %** of a batch quarantines → stop the
   phase.
2. **Any coordinate falls outside its stated state** → stop the batch.
3. **The Anna OH pair collapses within ~100 m** → stop the entire plan pending
   adjudication.
4. **Any new coordinate lands within 50 m of an existing coordinate at a
   different address** → quarantine, and stop if more than one occurs.
5. **Any protected column changes** (`is_published`, `parking_spaces`,
   `overnight_status`, `interstate`, `exit_number`, `mile_marker`) → stop
   immediately; this indicates the package is wrong, not the data.
6. **The planner-pool delta ≠ rows written** → stop; something outside the
   batch moved.
7. **A fingerprint shows an out-of-batch row changed** → stop.
8. **Rest-area rows enter any batch** without separate written authorization →
   stop.
9. **CAT Scale data would be consulted or written** → stop.
10. **Any row would require a `mile_marker`, an `exit_number`, or an
    `overnight_status` value to proceed** → stop; that is different work with a
    different evidence bar.
11. **A migration, schema change, or Supabase setting change becomes
    necessary** → stop. This plan requires none; needing one means the plan is
    wrong.
12. **A production deployment would be required** → stop. No code changes; the
    Trip Planner picks up new rows on its existing read path.
13. **Evidence becomes uncertain for any reason not listed above** → stop and
    report rather than lowering the bar.

**The standing rule behind all thirteen:** leaving a row at `lat IS NULL` costs
one location's planner visibility. Writing a wrong coordinate can route a
driver to a place that does not exist, at the hour they are out of hours. The
asymmetry is why every ambiguous case resolves to "quarantine."

---

## Preconditions before Phase 1 may begin

1. **Egress to `geocoding.geo.census.gov`** — the whole plan is blocked without
   it.
2. **Written decision on the two rest-area rows** (execute, or leave held).
3. **Confirmation that the six CAT Scale and eight operator rows stay
   excluded** — or explicit authorization to include them.
4. A pre-flight fingerprint capture and a reviewed per-state manifest,
   committed before any write.
