# Pilot / Flying J / ONE9 — execution record, 2026-07-27

The prepared 803-positive-parking package was executed against the live
directory under explicit authorization, after PR #195 (the TA/Petro line)
merged to `main` as `2105e86` and the Pilot baseline was re-proven against the
post-merge database (in-scope 222-row digest byte-identical to the committed
snapshot; fresh control digest `4b5aed26cb6cc4ce1597b53d021a4ef4`, 1,334 rows).

Source of record: `all_locations.csv`,
sha256 `d39ab57d51999f2468ff2f32790f8ab43a20b859559b0052e353272c9d1e330a` —
re-verified immediately before execution, together with every published figure
(875 / 820 / 55 / 803 / 17 / 72,189 / 43 / zero duplicates).

Execution order: **inserts → enrichment → publication canary → per-state
publication**, each in its own guarded transaction(s), exactly as prepared.
No guard was weakened at any point; every guard failure was resolved by
quarantining the affected record(s) and re-running with the batch counts
adjusted, guard text untouched.

---

## 1. Staging fidelity

The 719 reviewed INSERT tuples were loaded verbatim into a temporary staging
table (`public._pilot_stage_20260727`) and proven byte-equivalent to
`INSERT-NET-NEW.sql` before any write: 719 rows, 719 distinct source refs and
detail slugs, 60,746 total spaces, per-state counts identical, and a full
12-column `md5` digest (C collation) equal on both sides:
`1eae868e0664edf7d825aacd7bd759ca`. A splitter defect that silently dropped
111 tuples was caught by exactly this count-and-digest check and repaired
before execution. The staging table was dropped after the final value audits.

## 2. Inserts — 709 of 719 applied, 10 quarantined

One guarded transaction per state (43 transactions). Every transaction
re-checked, inside the transaction: exact staged row count, U.S. coordinate
envelope, no duplicate coordinate inside the batch, no duplicate
`detail_slug` inside the batch or against the live table, no existing store
number in the state (third-party brands excluded), no staged pin within
~150 m of a published pin, exact inserted row count, and a post-check that
nothing arrived published / featured / indexable / overnight.

Ten rows failed a guard and were quarantined — the guards were right every
time, and none was weakened:

| Ref | State | Guard | Cause |
|---|---|---|---|
| #282 | CA | 150 m adjacency | published official-TA pin (TA Barstow) |
| #46 | KY | 150 m adjacency | published TA Truck Service Franklin pin |
| #17 | MI | 150 m adjacency | published TA Battle Creek pin |
| #266 | NM | 150 m adjacency | published TA Las Cruces pin |
| #387 | NV | 150 m adjacency | published TA Express Carlin pin |
| #303 | OH | 150 m adjacency | published Petro Napoleon pin |
| #12 | OH | 150 m adjacency | published TA Toledo pin |
| #195 | OR | 150 m adjacency | published TA Express Biggs Junction pin |
| #35 | IN | store-number | third-party "Family Express #35" matches the number pattern |
| #700 | OH | store-number | site's own "CAT Scale — Flying J Travel Center #700, Perrysburg" row, name format missed by the `\(CAT #n\)` exclusion |

All ten carry a positive official parking count; every one is a
**cross-operator interchange neighbour or a guard-pattern false positive**,
not a data defect in the export. They are recorded in
`QUARANTINE-EXECUTION.csv` and stay out of the directory pending individual
review under a future authorization.

Post-insert audit: 709 tagged rows (`source = 'pilot-master-2026-07-27'`),
43 states, per-state counts exactly as adjusted, all unpublished, none
featured / indexable / overnight / soft-deleted, 14 zero-space among them,
709 distinct slugs, **0 value mismatches** against the digest-proven staging
table, 0 rows outside the staging set, 0 quarantined refs present. Spaces sum
60,175 = 60,746 staged − 571 on the ten quarantined rows.

## 3. Enrichment — 80 of 84 applied, 4 quarantined

`ENRICH-EXISTING.sql` was executed verbatim first. The published-pin
collision guard aborted the whole transaction (6 staged-coordinate /
published-pin pairs, zero writes) — the guard did its job. The four affected
targets were quarantined and the transaction re-run with 80 rows; the guard
text was not changed:

| Ref | State | Row | Colliding published pin(s) |
|---|---|---|---|
| #1330 | AR | 69f1f244 | "Diesel Truck Repairs", Brinkley (~50 m) |
| #1550 | AL | d7247403 | "Jack's Truck Stop" + its truck wash, Cullman (~90 m) |
| #353 | KY | a8a32662 | Motel 6 Georgetown + First American Truck Wash |
| #95 | FL | 76f653aa | "TA Wildwood" truck stop (~150 m) |

The whole row was quarantined in each case — not just the coordinate fill —
because a pin collision puts the site identity in question and writing any
field to a questionable identity is not blank-only enrichment, it is a guess.

Applied: **78 coordinate fills** (each with `geocode_source='batch-csv'`,
`geocode_confidence='high'`, `coord_verification_status='machine-checked'`)
and **36 parking-space fills**, including the two spaces-only rows verified
by value afterwards (ONE9 #403 → 25, Pilot #1577 → 88; their pre-existing
`interpolation` coordinates were not touched). Blank-only held per field;
nothing was published, featured, indexed or marked overnight by enrichment.

Post-enrichment audit: control digest `4b5aed26cb6cc4ce1597b53d021a4ef4`
byte-identical (1,334 rows); 222 pre-existing network rows still 222; the four
quarantined targets untouched by fingerprint; published-unmappable fell
608 → 555 (53 published coordless rows gained their first pin).

## 4. Publication — canary 10, then 685 per state; 695 total

`PUBLISH-CANARY.sql` ran verbatim: 10 locations, 10 states, 10 distinct
corridors (I-5, I-10, I-15, I-35, I-70, I-80, I-84, I-90, I-94, I-95), all
with positive official parking and operator coordinates. Canary audit passed
before anything else was published: 10 published, zero zero-space published,
no featured / indexable / overnight, directory published 1,167 → 1,177.

The remainder then ran as **43 separate guarded per-state transactions** with
the exact PUBLISH-PER-STATE guard, counts measured live per state (the
prepared PUBLISH-REMAINDER counts predate the ten insert quarantines and were
superseded by the live counts; guard text identical): 685 rows published.

**695 of the 705 positive-parking inserted rows are now published** (the ten
quarantined rows were never inserted). The 14 zero-space inserted rows remain
unpublished — see §7. No pre-existing row's publication state was changed:
publication was authorized for imported rows only.

## 5. Final audit — everything out of scope byte-identical

| Measurement | Before | After | |
|---|--:|--:|---|
| Control digest (1,334 out-of-scope rows) | `4b5aed26…` | `4b5aed26…` | byte-identical |
| Third-party digest (50 rows, 41 published) | `b22022a4…` | `b22022a4…` | byte-identical |
| Total live rows | 1,556 | **2,265** | +709 inserts |
| Published | 1,167 | **1,862** | +695 (imports only) |
| With coordinates | 564 | **1,351** | +709 +78 |
| Published unmappable | 608 | **555** | −53 |
| Featured / indexable / soft-deleted | 0 / 0 / 0 | 0 / 0 / 0 | unchanged |
| Canadian rows under the import tag | — | **0** | VERIFY §10 clean |
| Duplicate slugs / import store numbers | — | **0 / 0** | |
| Imported rows claiming overnight | — | **0** | never invented |

The directory-wide census found 29 exact-duplicate published coordinate
groups. **None involves a coordinate this package wrote**: zero contain
imported rows, zero contain enriched network pins. The only rows in those
groups touched today are eight TA rows written this morning under the
already-merged TA authorization (including its documented one-record
same-site exceptions) and the two spaces-only targets above, whose
coordinates are old `interpolation` values — only their `updated_at` moved.

## 6. Gates 3a and 3b — measured, kept separate

| Gate | Universe | Measured after execution |
|---|--:|--:|
| **3a — U.S. directory coverage** | 820 | **809 represented** |
| **3b — U.S. truck-parking coverage** | 803 | **763 route-usable** |

3a: 709 inserted + 100 matched pre-existing sites (87 exact + 8 blank-only +
5 address-matched) = **809 of 820**. Absent: the 10 quarantined inserts and
conflicting record #749 VA (store number matches, street address contradicts
— untouched by design).

3b: 695 published imports + 68 matched sites whose pre-existing `truck-stops`
row is published, mappable and carries a positive count = **763 of 803**,
measured live per row. The three matched zero-space sites (#89 FL, #265 TN,
#321 KY) are confirmed outside the count. The remaining gap of 40:

- 10 quarantined positive-parking inserts (pending collision review);
- 29 matched positive-parking sites whose pre-existing rows stay
  **unpublished** — enrichment never publishes, and publishing pre-existing
  rows was not part of this authorization. They now hold coordinates and/or
  space counts and need only a publication authorization of their own;
- 1 conflicting record (#749 VA), which needs identity resolution first.

## 7. The 17 zero-space locations — staged, not parking (Phase 4)

14 were inserted **unpublished**; 3 exist as matched pre-existing rows and
were not touched. None is published by this package, because the application
does not yet hard-exclude zero-space rows from route-usable queries:
`rankCandidates` / `recommendParking` in
`src/lib/trip-planner/directory-layer.ts` give a zero-space row
`parkingScore = 0` but do **not** filter it out, so a published zero-space
row could still surface as a parking recommendation in a thin corridor.

**Required application change before any zero-space publication:** a hard
exclusion of `parkingSpaces <= 0` for the `parking` and `overnight` needs in
`rankCandidates`/`recommendParking` (and any route-usable/legal-stop query),
with tests proving a zero-space row can never be returned. Until that lands
and is separately authorized, the 17 stay directory-staged only.

## 8. Rollback readiness

`ROLLBACK.sql` remains a complete, guarded reverse path for everything this
execution wrote, in reverse order: source-scoped unpublish (695), per-row
value-matched de-enrichment keyed on the exact staged values and
`geocode_source='batch-csv'` (so re-run rows or independently re-geocoded
rows are refused, not clobbered), and source-scoped delete with refusals for
published rows and rows predating the import. The four quarantined enrichment
rows were never written, so their rollback entries match nothing — by design.

## 9. Accounting

| | Count |
|---|--:|
| U.S. locations in source | 820 |
| Inserted | **709** |
| Insert-quarantined | **10** |
| Enriched (pre-existing rows) | **80** |
| Enrichment-quarantined | **4** |
| Published (imports, incl. 10-store canary) | **695** |
| Zero-space inserted, staged unpublished | **14** |
| Matched zero-space, untouched | **3** |
| Conflicting record, untouched | **1** (#749 VA) |
| Canadian rows imported | **0** of 55 |
| Rows written outside the authorization | **0** |

Per-state published imports (canary included): AL 11, AR 6, AZ 38, CA 41,
CO 5, CT 1, FL 18, GA 16, IA 17, ID 10, IL 40, IN 27, KS 6, KY 20, LA 13,
MA 2, MD 3, MI 8, MN 5, MO 24, MS 9, MT 17, NC 12, ND 7, NE 6, NJ 8, NM 15,
NV 15, NY 8, OH 30, OK 11, OR 10, PA 18, SC 21, SD 4, TN 9, TX 116, UT 17,
VA 19, WA 9, WI 9, WV 3, WY 11 = **695**.

Brand identity was preserved verbatim throughout; nothing was renamed to
"Pilot". Overnight permission was never written: every imported row carries
`overnight_parking = false`, which means **not confirmed**, never
"prohibited" — and no imported row may be offered as overnight or HOS-rest
parking until an authoritative source states it.
