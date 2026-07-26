# Northeast MD/DE — deferred records (not geocoded, not published)

Three of the six MD/DE truck-stop/travel-plaza candidates could not be geocoded
to the project's evidence standard (two independent authoritative sources, high
confidence) from offline data, so they are **left unchanged** — no coordinate
written, still unpublished. This is authoritative evidence of a sourcing gap,
not a guess. Web egress to official/DOT/map hosts is blocked (HTTP 403) and must
not be routed around.

| Name | City, ST | UUID | Reason deferred |
|---|---|---|---|
| Maryland House Travel Plaza | Aberdeen, MD | `0c8f2702-18ba-465d-ad9f-7222b3db2744` | US Census `census-no-match`. Median I-95 service plaza addressed by mile marker (MM82); no street address to geocode. Not a TA/Petro brand, so absent from the operator master. |
| Chesapeake House Travel Plaza | North East, MD | `80786332-ef51-4045-9f28-a33abfbf56bd` | US Census excluded `highway-or-insufficient`. Median I-95 service plaza (MM97); no street address. Absent from the operator master. |
| Biden Welcome Center (I-95 Service Plaza) | Newark, DE | `7d3ead5b-1237-474f-9154-06b410f7b410` | Single fuzzy Census match only: `530 JFK MEMORIAL, NEWARK, DE, 19702` (input zip 19713 → matched 19702), classification `census-manual-review` (medium). No corroborating second source (not in the operator master). Held for manual verification. |

## Method to resolve later (when egress is available or a source file is supplied)

1. Obtain a rooftop/entrance coordinate for each plaza from an authoritative
   source (state DOT service-plaza listing, operator site, or a supplied file).
2. Cross-check against a second independent source; require agreement < 500 m
   for `high` confidence (the bar the 3 published TA rows cleared).
3. Add the row to a geocoding batch CSV under `data/geocoding/`, geocode +
   verify, then publish under the same guarded flow used here
   (blank-only write → ROW_COUNT guard → 3-then-remaining publish).

For the median plazas specifically: their coordinate is the plaza structure in
the I-95 median, not the nearest interchange — the mile-marker location must be
resolved to the physical plaza, not to a highway centroid.
