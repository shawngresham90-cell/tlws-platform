# NTAD canary — approved-versus-held manifest (2026-07-28)

Machine-readable twin: `CANARY-MANIFEST.json` (the test harness
`scripts/test-ntad-canary.ts` proves the SQL matches it exactly).

## Approved for the prepared (unexecuted) insert package — 5 rows

| # | Facility | State | Route/direction | Inserted as |
|---|---|---|---|---|
| 1 | Guilford Welcome Center | VT | I-91 North MM 5.6 | unpublished · `parking` · spaces NULL · overnight false |
| 2 | Kennebunk Service Plaza (Northbound) | ME | I-95 MM 25 NB | same |
| 3 | Smyrna Rest Area | DE | US 13 / DE-1 Exit 119 (single bidirectional facility) | same; overnight false is STATE-CONFIRMED (10-hr max stay) |
| 4 | Darien Service Plaza (Southbound) | CT | I-95 SB ~MM 10 | same |
| 5 | Gold Run SRRA (Eastbound) | CA | I-80 EB PM ~41.4 | same; count conflict documented, neither figure stored |

Approval bar met by all five: current official identity + current operating
status + current truck-parking evidence, all from state-DOT / toll-authority
domains (see `CANARY-EVIDENCE.md` for URLs and dates). **No NTAD-2019 fact
is stored as current: every `parking_spaces` is NULL and every
`overnight_parking` is false.** With NULL spaces and unpublished state, no
canary row can enter the directory, the map, or any trip-planner
recommendation until separately enriched and published under future
authorizations.

## Held — 3 facilities, zero SQL

| Facility | State | Hold reason |
|---|---|---|
| Grand Bay Welcome Center | AL | No current official truck-parking evidence (2019-survey only); operating status listed but not live-confirmed (ALGOtraffic click-through required) |
| Guilford North Parking Area (NTAD, I-91 N MM 1) | VT | Identity: not individually identifiable on any official Vermont page; possibly decommissioned |
| NHS Rest Stop or Truck Facility 9 (NTAD, I-95 N York) | ME | Identity: anonymized federal name; no official publishable identity resolved |

Also standing: weigh stations are a separate category platform-wide and are
never offered as truck parking without explicit parking evidence — no weigh
station is in this package.

## Duplicate and coordinate-collision review (2026-07-28, offline)

Run against the same-day live-directory export (2,159 rows: all 1,968
coordinated rows + 191 coordless rest/weigh/parking rows):

- **Coordinate collisions within 250 m: NONE** for all six candidates
  (including held AL).
- **Name duplicates (state + name substring): NONE** for all six.
- The SQL additionally re-proves a ±0.0015° empty box in-transaction at
  execution time, and aborts on any surprise.

## Coverage impact (when the package is executed AND rows are later
published under separate authorizations)

- Launch-gate line 5 (official public rest areas/welcome centers/service
  plazas) moves from "not sourced" to "sourced, canary in directory" — the
  first five official public facilities, one per state across VT/ME/DE/CT/CA.
- State firsts: VT, ME, DE gain their first public rest-facility rows
  (three of the six zero-coverage jurisdictions); AK/HI/DC remain at zero
  (see `SOURCE.md` for their identified official channels).
- Corridor firsts: I-95 gains two public facilities (ME NB, CT SB), I-80
  one (CA EB), I-91 one (VT).
- **No published/mappable/recommendable count changes at execution time**:
  rows land unpublished with NULL counts. Published coverage moves only at
  the future publication step.

## Execution preconditions (future authorization, not this PR)

1. The six human click-throughs in `CANARY-EVIDENCE.md` completed and dated.
2. Fresh full-table + scope fingerprints captured pre-write.
3. `CANARY-ROLLBACK.sql` already committed (this PR) — re-verify values.
4. Guarded execution, then `CANARY-VERIFY.sql`, then post-write fingerprints
   proving only the five rows appeared.
