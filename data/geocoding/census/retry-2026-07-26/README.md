# Census retry batch (2026-07-26) — and a correction to the "32 missing rows"

Read-only. **No coordinates were written and nothing was published in this
milestone.** This folder records a scope correction, a hard blocker, and a
ready-to-submit batch input.

## Scope correction — the "32 not in Census batch" label was wrong

The prior nationwide audit (PR #187) classified 32 rows as *"not in Census
batch."* Re-checking the committed results file row by row shows that label
conflated two very different things:

| Actual status | Rows | What it means |
|---|--:|---|
| Submitted, geocoder returned **`No_Match`** | **27** | They *were* in `census-full-run-input.csv` and came back with a 3-column `No_Match` record |
| **Never submitted** (absent from the batch input) | **5** | Filtered out before the batch was built |
| **Total** | **32** | |

The prior parser required ≥6 columns to treat a row as "present in results", so
the 3-column `No_Match` records read as absent. The published/quarantined counts
in PR #187 are unaffected — those 32 rows were excluded from publication either
way — but the *reason* recorded for 27 of them was wrong, and this file is the
correction.

## The 5 that were genuinely never submitted — and why

| Row | State | Why it was not in the batch |
|---|---|---|
| `d296a4d1` Allstate Repair (All State Truck Stop) | GA | already had `lat`/`lng`; the batch input was built from `lat is null` |
| `d9b97d0d` Crazy Ed's Travel Center | TN | already had `lat`/`lng` |
| `7deb34cf` Ponderosa Truck Stop | TN | already had `lat`/`lng` |
| `01d5116b` Truck Parking Club — Candler lot | NC | `highway-or-insufficient`: address is "Smokey Park Hwy (exact street number not published in listing preview)" — no house number |
| `e587e93e` Pedro's / Porky's Truck Stop | SC | `highway-or-insufficient`: address is the intersection "US-301 / US-501" — no house number |

### None of the 5 qualifies for publication

The three that already carry coordinates all have
**`geocode_source = 'interpolation'`** — medium confidence, below the
Exact/high bar this milestone requires — and two of them land on top of a
**held network**:

| Row | Nearest published row | Distance |
|---|---|--:|
| Crazy Ed's Travel Center | **Pilot Travel Center #4598** (held) | **0 m** |
| Ponderosa Truck Stop | **Love's Travel Stop #364** (held) | **0 m** |
| Allstate Repair | *(no row within 200 m)* | — |

An interpolated coordinate collapsing exactly onto a neighbouring business is
the classic interpolation failure mode. Publishing either row would place a
listing on a held-network site. Both are **disqualified** on proximity and
held-network collision; Allstate Repair is clean on proximity but still rests on
an unverified interpolated coordinate, so it is disqualified on confidence.

The remaining two have no house number and cannot be geocoded at all without an
address correction, which is explicitly out of scope for this milestone.

**Result: 0 of 5 qualify → nothing was published, per the milestone's own
"fewer than three qualify" rule.**

## Hard blocker — the Census geocoder is unreachable from this environment

```
https://geocoding.geo.census.gov/... → CONNECT tunnel failed, response 403
```

The sandbox egress allowlist covers package registries and Anthropic hosts only;
`geocoding.geo.census.gov` is denied, exactly as
`data/geocoding/census/full-run/README.md` already documents. The policy was not
bypassed. **No new Census results can be produced here**, so the 27 `No_Match`
rows could not be retried in this run.

## `census-retry-input.csv` — ready to submit by hand

The 27 `No_Match` rows in the official 5-column, headerless Census batch format,
with addresses copied **verbatim** from the prior batch input. No address was
corrected, normalized, or invented.

- rows: **27**
- sha256: `6a80fea1a532499182c0de9cd59116ca2708964ec395839d4007c17277bd404f`

Submit per the documented flow in `../full-run/README.md`: upload at the Census
batch page, save the raw result unchanged under `../raw/`, then classify with
`scripts/validation/validate-geocodes.ts`.

### The one legitimate lever on a re-run

Re-submitting an identical address to the identical benchmark is deterministic —
it will return `No_Match` again. The only in-scope variation is the
**benchmark**: the prior run used `Public_AR_Current`; `Public_AR_ACS` and
`Public_AR_Census2020` use different vintages of the address range file and can
match where `Current` does not. That is a geocoder-side change, not an address
correction, so it stays within this milestone's rules.

Anything beyond that requires an **address-correction pass under separate
authorization**, with its own evidence file — several of the 27 are missing a
ZIP or carry a route-style address (e.g. `9499 US Highway 70`, Lehi AR, blank
ZIP) that the TIGER matcher cannot resolve as written.
