# Canary recommendation, and what the batch would be worth

## Recommendation: no canary this run

**Zero locations are recommended for a first canary.** Not a small canary — none.

The brief asks for 10–20 geographically diverse Tier-A locations "if the
evidence supports it". It does not. Tier A requires an exact coordinate, no
reachable source can supply one (`BLOCKED-SOURCES.md`), and the only two ways to
produce a canary anyway would be to publish rows with no coordinate — which
`PUBLISH-TEMPLATE.sql` correctly refuses — or to invent coordinates. Neither is
acceptable, so the honest output is an empty canary and a ready queue.

## The canary that is ready to run the moment coordinates land

These 32 facilities (34 rows, less the quarantined GA row) satisfy every
Tier-A criterion except the coordinate. They are listed in the order they
should be canaried: geographically diverse, 10 states, 3 corridors, all five
public facility types.

**Proposed first canary — 12 locations, 8 states, 3 corridors:**

| # | Facility | State | Corridor | Dir | Type | Parking evidence (source text) |
|---|---|---|---|---|---|---|
| 1 | Ladysmith Safety Rest Area | VA | I-95 | NB | rest area | VDOT — truck spaces stated |
| 2 | Ladysmith Safety Rest Area | VA | I-95 | SB | rest area | VDOT — truck spaces stated |
| 3 | Carson Safety Rest Area | VA | I-95 | — | rest area | VDOT — ~35 truck/RV/bus spaces, MM 37 |
| 4 | St. Johns County Rest Area (MM 302) | FL | I-95 | — | rest area | FDOT — truck parking stated |
| 5 | Martin County Rest Area (MM 106) | FL | I-95 | — | rest area | FDOT — truck parking stated |
| 6 | Santee Rest Area | SC | I-95 | NB | rest area | SCDOT — truck parking stated |
| 7 | Hamer Welcome Center | SC | I-95 | SB | welcome center | SCDOT — truck parking stated |
| 8 | NC Welcome Center — Northampton | NC | I-95 | — | welcome center | NCDOT — truck parking stated |
| 9 | Chesapeake House Travel Plaza | MD | I-95 | — | service plaza | MDTA — dedicated truck parking |
| 10 | I-75 Rest Area — Miami County | OH | I-75 | NB | rest area | ODOT — truck parking stated |
| 11 | Dickson County Rest Area (MM 170) | TN | I-40 | EB | rest area | TDOT — truck parking stated |
| 12 | TDOT I-65 Truck Parking Area (Giles County) | TN | I-65 | NB | truck parking | TDOT — converted weigh station, purpose-built truck parking |

Why this shape: it is **8 I-95 rows out of 12**, because I-95 is the corridor
with 27 existing rows and zero published — the largest single gap the directory
has. It includes both halves of one directional pair (1 and 2) so the pair
handling is exercised on the first run rather than discovered later. It includes
one MDTA plaza (9) so the same-facility dedupe is exercised. And it includes
the TDOT converted weigh station (12) so the one facility type that required a
classifier exception is proven end to end.

Each would be verified through the directory's own query contract before the
remaining 20 are published, exactly as previous milestones did.

**URLs each would create** — `/directory/location/<detail_slug>` for the
listing, plus its corridor page (`/directory/i95`, `/directory/i75`,
`/directory/i40`) and `/directory/parking`. Exact slugs are already in the
database on each row; none is guessed here.

### Excluded from the canary, deliberately

- **`49bf9a34` GA "Carson Safety Rest Area"** — name/state anomaly, quarantined
  (see `RECONCILIATION.md`). It would otherwise have ranked in the top few.
- **The second MDTA row of each pair** — `6bc0c663` and `208bb775` duplicate
  `80786332` / `0c8f2702` as physical places. One canonical row per plaza must
  be chosen first.

## Separate authorizations

These are three distinct decisions and should be granted separately:

| Step | What it does | Authorization needed |
|---|---|---|
| **Enrichment** | writes lat/lng + provenance to existing rows, blank-only | write access; reversible via `ROLLBACK-TEMPLATE.sql` de-enrich block |
| **Publication** | flips `is_published` on enriched rows, one state per transaction | separate; reversible via the unpublish block |
| **Insertion** | creates net-new rows for I-80 / I-90 / I-10 / I-15 | **not requested this run** — no net-new candidate was prepared |

No insertion is proposed. No net-new candidate exists, because discovering one
requires the same blocked sources.

## Expected coverage impact

Stated as arithmetic on the directory's own counts. **No traffic, revenue,
occupancy or conversion figure appears here**, because none can be measured
from this environment and inventing one would be worthless.

If all 32 facilities were eventually enriched and published:

| Measure | Now | After | Change |
|---|--:|--:|---|
| Published parking locations | 76 | 108 | **+32 (+42 %)** |
| Published **and mappable** | 31 | 63 | **+32 (+103 %)** |
| States with published parking | 10 | **14** | +4 (MD, SC, VA + GA pending name fix) |
| States with zero | 40 | 36 | −4 |
| Corridors with published parking | 3 | **4** | +1 (**I-95, from 0**) |
| I-95 published parking | **0** | **~20** | the corridor goes from absent to covered |

New states unlocked: **VA (7), SC (4), MD (2 facilities), NC** — NC already has
published parking on I-40 but none on I-95, so it gains a corridor rather than
a state.

### Exit and mile-marker pages

Of the 35 pending rows, **2 carry an `exit_number`** today (`NC d4a2a4fa` exit 1,
`NC 046b382e` exit 180). The rest are mile-marker addressed, and the exit value
is one of the fields the agency dataset would supply. So the honest expectation
is **at least 2 new exit pages, and up to ~30** depending on what the agency
records contain. That range is stated rather than collapsed to a single
flattering number.

### Map usefulness

This is where the change is largest and least visible in a row count. The
directory currently has **45 published parking pages with no coordinate** —
they cannot appear on the map, cannot be sorted by distance, and cannot answer
"what's near me", which is the question a tired driver actually asks. The
enrichment work fixes that class of defect for every row it touches, including
rows that are *already published*. Coordinates for the existing published set
are a bigger usability win than the new publications, and they need no
publication authorization at all.

### Corridor sponsorship inventory

Sponsorship capacity is defined in `src/lib/directory/placements.ts`: one
primary sponsor per corridor page (`PRIMARY_CORRIDOR_SPONSORS = 1`) and up to
three featured listings per category/corridor page (`FEATURED_PER_PAGE = 3`).

Publishing I-95 parking would make `/directory/i95` a page with real content
for the first time. In inventory terms that is **1 primary corridor slot and up
to 3 featured slots** on a corridor page that currently has nothing to sponsor.
That is capacity, not revenue: no rate is implied, no prospect is named, and
whether any of it sells is unknown.

## Honest caveats

1. Every number above is conditional on coordinates that do not yet exist.
2. "Truck parking confirmed" here means the row's stored description, sourced
   from an agency page, says so. The agency's **structured** dataset may
   disagree — a space count of 0, a car-only designation, a seasonal closure —
   and the dataset wins. Some of the 32 will not survive that check.
3. Space counts, hours and amenities are currently `null` for all 35 and stay
   null until an agency states them.
