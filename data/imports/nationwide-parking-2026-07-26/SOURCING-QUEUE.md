# Sourcing queue — what to fetch, per state, to unblock publication

Ordered by how much published coverage each fetch unlocks. Every target is a
primary agency source. Nothing here has been fetched (see `BLOCKED-SOURCES.md`);
this is the worklist for when egress allows or the layers are supplied
out-of-band.

Column meanings:
- **Pending** — rows in `RECONCILIATION-216.csv` marked `A-PENDING-COORDINATE`
  for that state; these resolve immediately on a coordinate.
- **Also unlocks** — quarantined rows in the same state that a proper agency
  dataset would additionally settle (by confirming truck parking, correcting a
  name, or replacing a third-party source).

## Tier 1 — existing rows, highest yield

| State | Pending | Also unlocks | Agency | Source already cited on the rows |
|---|--:|--:|---|---|
| VA | 7 | 4 | VDOT | `vdot.virginia.gov/about/our-system/highways/rest-areas/` |
| FL | 6 | 7 | FDOT | `fdot.gov` (+ `fdacs.gov` for inspection stations) |
| TN | 6 | 11 | TDOT | `tn.gov/tdot`, `smartway.tn.gov` |
| MD | 4 | 3 | MDTA | `mdta.maryland.gov/MD_I-95_Travel_Plazas/Home.html` |
| SC | 4 | 2 | SCDOT | `scdot.org` (+ `scdps.sc.gov`) |
| OH | 2 | 2 | ODOT | `transportation.ohio.gov` |
| AR | 2 | 9 | ARDOT | `ardot.gov` |
| NC | 2 | 11 | NCDOT | `ncdot.gov` (+ `commerce.nc.gov` welcome centers) |
| GA | 1 | 7 | GDOT | `dot.ga.gov/GDOT/Pages/restareaswelcomecenters.aspx` |
| IN | 1 | 4 | INDOT | `in.gov/indot` |
| AL | 0 | 8 | ALDOT | `dot.state.al.us` |
| KY | 0 | 4 | KYTC | *(rows cite `kentuckyrestareas.com` — third-party; needs KYTC)* |
| MI | 0 | 9 | MDOT | *(rows cite `michiganrestareas.com` — third-party; needs MDOT)* |
| IL | 0 | 3 | IDOT | *(no source on any row)* |

**35 pending · 84 additional rows unlocked · 14 states.**

The four states with 0 pending are there because every one of their
parking-relevant rows currently rests on a third-party aggregator or no source
at all. An agency dataset would not merely add a coordinate — it would move
those rows from `C:quarantine-no-official-source` into scope.

## Tier 2 — corridors that need net-new records

These states hold **no** parking rows at all, so no amount of enrichment helps.
They need discovery from an agency dataset first. Listed in the brief's
priority order, with the corridor each serves.

| Corridor | States with no parking rows | Primary datasets to fetch |
|---|---|---|
| I-80 | PA, NJ, OH*, IN*, IL, IA, NE, WY, UT, NV, CA | PennDOT, NJDOT, Iowa DOT, NDOR, WYDOT, UDOT, NDOT, Caltrans |
| I-90 / I-94 | NY, PA, OH*, IN*, IL, WI, MN, SD, MT, ND, MI* | NYSDOT/Thruway, WisDOT, MnDOT, SDDOT, MDT, NDDOT |
| I-10 | CA, AZ, NM, TX, LA, MS, AL*, FL* | Caltrans, ADOT, NMDOT, TxDOT, LADOTD, MDOT |
| I-15 | CA, NV, AZ, UT, ID, MT | Caltrans, NDOT, ADOT, UDOT, ITD, MDT |
| I-95 NE | DE, PA, NJ, NY, CT, RI, MA, NH, ME | DelDOT, PennDOT, NJDOT, NYSDOT, CTDOT, RIDOT, MassDOT, NHDOT, MaineDOT |

\* state already has rows on a *different* corridor, none on this one.

Two datasets are known to exist and to carry truck-specific attributes, which
makes them the best first fetches for Tier 2:

- **Nevada DOT** truck parking layer — carries parking spaces, fuel, restrooms,
  showers, scale, truck wash. Serves I-80 and I-15.
- **Caltrans** `CHhighway/Rest_Areas` FeatureServer — statewide Safety Roadside
  Rest Areas. Serves I-5, I-10, I-15, I-80.

Both were located by search; neither was retrieved.

## What to record for every candidate

The brief's evidence schema, which `manifest.schema.json` enforces and
`scripts/test-parking-expansion.ts` tests:

exact source URL · source agency/operator · retrieval date · facility name ·
state · interstate · direction · exit or mile marker · latitude · longitude ·
confirmed truck-parking status · parking-space count *when officially stated* ·
hours or restrictions · amenities · confidence · evidence notes.

Fields absent from the source stay **null**. A space count, an hours
restriction or an amenity is recorded only when the agency states it. None of
these may be inferred from a photo, a review site, or a neighbouring facility.

## Standing rules for this queue

1. A rest area is not automatically truck parking. Many are car-only or have a
   handful of spaces; the source must say so.
2. A weigh station is not parking. Only an explicit agency statement that
   parking is permitted moves one out of quarantine — as TDOT's two converted
   I-65 sites did.
3. Directional pairs get **two** coordinates, never one shared between them.
4. Never resurface a held/excluded network (Love's, Pilot, Flying J, Sapp Bros,
   Goasis, Thorntons), including as a landmark in a name.
5. No contact with any agency or operator. These are public datasets; fetch
   them, do not write to anyone.
