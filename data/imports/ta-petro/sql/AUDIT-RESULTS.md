# TA/Petro import — full 304-row audit results

Live, read-only audit run immediately after the final state committed.
Source label: `official-ta-petro-20260725-5ebe0e9f`.
All 8 checks pass.

## Starting checkpoint (queried before any write)

| Metric | Expected | Live | Match |
|---|--:|--:|---|
| Applied | 137 / 304 | 137 / 304 | yes |
| Live total | 1,389 | 1,389 | yes |
| Original rows | 1,252 | 1,252 | yes |
| Unpublished | 137 / 137 | 137 / 137 | yes |
| Missing coordinates | 0 | 0 | yes |

Checkpoint matched exactly, so the run proceeded per the decision rule.

## Preflight gate

```
batch rows before run: 137   (accepted range 137..304)
pre-existing rows:    1252   (required exactly 1252)
```

Both conditions passed; no exception raised.

## AUDIT 1 — headline totals

| Field | Expected | Actual |
|---|--:|--:|
| batch_total | 304 | **304** |
| unpublished | 304 | **304** |
| missing_coordinates | 0 | **0** |
| geo_writes | 0 | **0** |
| source_label_count | 304 | **304** |
| cat_scale_asserted | 0 | **0** |
| featured_or_indexable | 0 | **0** |

## AUDIT 2 — live totals

| Field | Expected | Actual |
|---|--:|--:|
| live_total | 1,556 | **1,556** |
| preexisting_rows | 1,252 | **1,252** |
| preexisting_changed | 0 | **0** |

## AUDIT 3 / 4 — per-state reconciliation (all 43 states)

`expected_total = 304`, `inserted_total = 304`, `mismatched_states = 0`,
`states_checked = 43`, `mismatch_detail = none`.

```
AL=8  AR=3  AZ=10 CA=14 CO=9  CT=3  FL=5  GA=8  IA=6  ID=2
IL=12 IN=10 KS=10 KY=3  LA=12 MI=4  MN=4  MO=13 MS=4  MT=2
NC=3  ND=5  NE=3  NH=1  NJ=4  NM=9  NV=10 NY=7  OH=14 OK=7
OR=6  PA=14 RI=1  SC=5  SD=3  TN=2  TX=40 UT=3  VA=5  WA=4
WI=7  WV=4  WY=5
```

Every state's inserted count equals its payload count. Zero skipped, zero
rolled back, zero quarantined.

## AUDIT 5 — duplicate-key reconciliation (whole live table)

| Field | Expected | Actual |
|---|--:|--:|
| duplicate_canonical_keys (name\|city\|state) | 0 | **0** |
| duplicate_unique_keys (type\|state\|city\|slug) | 0 | **0** |

## AUDIT 6 — malformed-value check on all 304 batch rows

| Field | Expected | Actual |
|---|--:|--:|
| blank_name | 0 | **0** |
| blank_city | 0 | **0** |
| blank_address | 0 | **0** |
| bad_state | 0 | **0** |
| bad_zip | 0 | **0** |
| out_of_range_coords | 0 | **0** |
| wrong_type | 0 | **0** |
| blank_slug | 0 | **0** |
| blank_detail_slug | 0 | **0** |

`detail_slug` is populated on all 304 rows by the existing `set_detail_slug`
BEFORE INSERT trigger, confirming it was correctly never supplied.

## AUDIT 7 — held / excluded networks untouched

| Field | Expected | Actual |
|---|--:|--:|
| excluded_or_held_in_batch | 0 | **0** |

Matched against `%love%`, `%sapp%`, `%pilot%`, `%goasis%`, `%thornton%`.
Combined with `preexisting_changed = 0` from audit 2, the Love's Florence
correction, Sapp Bros, the Pilot-network file, the 6 Goasis/Thorntons rows and
the 37 manual-review rows are all confirmed unchanged.

## AUDIT 8 — rollback-selection check

| Field | Expected | Actual |
|---|--:|--:|
| rollback_would_select | 304 | **304** |

The source label selects exactly the imported batch and nothing else, so the
batch remains cleanly revertible.

## Not done

Nothing was published, merged, or geocoded. All 304 rows are unpublished and
await separate review.
