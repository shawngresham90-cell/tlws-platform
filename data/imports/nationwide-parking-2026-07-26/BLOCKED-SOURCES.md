# Authoritative sources — blocked, and what that costs

Every primary source this milestone needed is unreachable from the build
environment. Network policy was **not** bypassed, and no coordinate was
invented, interpolated, or taken from a search-result snippet in its place.

## What was attempted

Two independent paths were tried for each host: a direct `curl` and the
sanctioned `WebFetch` tool. Both fail.

| Host | Purpose | curl | WebFetch |
|---|---|---|---|
| `data.transportation.gov` | USDOT / BTS open data (Socrata) | `000` | HTTP 403 |
| `geo.dot.gov` | USDOT geospatial portal | `000` | — |
| `www.fhwa.dot.gov` | FHWA truck parking (Jason's Law) | `000` | — |
| `www.transportation.gov` | USDOT | `000` | — |
| `rosap.ntl.bts.gov` | National Transportation Library | `000` | — |
| `services.arcgis.com`, `www.arcgis.com`, `hub.arcgis.com` | ArcGIS feature services | `000` | — |
| `caltrans-gis.dot.ca.gov` | Caltrans Rest_Areas FeatureServer | `000` | HTTP 403 |
| `gis.dot.nv.gov` | NDOT truck parking layer | `000` | — |
| `gis-fdot.opendata.arcgis.com`, `www.fdot.gov` | FDOT open data | `000` | — |
| `data-ncdot.opendata.arcgis.com` | NCDOT open data | `000` | — |
| `gisdata.iowadot.gov` | Iowa DOT GIS | `000` | — |
| `gis.dot.state.oh.us`, `www.dot.state.oh.us` | ODOT GIS | `000` | — |
| `geodata.md.gov` | Maryland iMAP | `000` | — |
| `www.penndot.pa.gov` | PennDOT | `000` | — |
| `nj.gov` | NJDOT truck parking | `000` | — |
| `geocoding.geo.census.gov` | US Census batch geocoder | blocked (prior milestones) | — |

`000` is curl's "could not connect". The proxy's own denial log records the
reason for each as `connect_rejected — gateway answered 403 to CONNECT
(policy denial or upstream failure)`.

`WebSearch` *does* work and was used to identify which datasets exist and where
they live — that is how the Caltrans, NDOT, FDOT and NJDOT layers above were
located. But a search result is a title and a URL. It is not the dataset, and
the standing rule against relying on search snippets holds: **no candidate was
created, and no coordinate recorded, from search output.**

## What this blocks, precisely

One field: **the rooftop coordinate**.

The 216 reconciled rows already carry, from a prior import, a facility name, a
state, a corridor, a direction, an agency source URL for 90 of them, and — for
45 — description text that explicitly confirms truck parking. What none of them
has is a latitude and longitude, and there is no reachable source to supply one.

The Census batch geocoder, the fallback used by earlier milestones, cannot help
here even if it were reachable: these rows are addressed by mile marker,
carriageway, or median plaza ("I-95 Southbound", "MM 199, EB and WB"). The
repository's own pipeline (`src/lib/directory/census-geocoder.ts`) already
classifies that shape as `highway-or-insufficient`. That is *why* these 216
rows were set aside as class 2 in the first place.

## Consequence for the tiers

The brief defines Tier A as *official source + exact coordinates + truck
parking explicitly confirmed*. The middle term cannot be satisfied for any row.

- **Tier A: 0.**
- **Tier B** also requires coordinates. **0.**
- Every row therefore falls to Tier C, which is technically correct and
  practically useless as a report.

So this package additionally records **`A-PENDING-COORDINATE`** — 35 rows that
satisfy every Tier-A criterion *except* the coordinate. That is not a
weakened Tier A and none of them may be published. It is a work queue: the
moment one authoritative layer becomes reachable, those 35 are the first
records to resolve, and `ENRICH-TEMPLATE.sql` is already written to accept them.

**No canary is proposed this run.** Proposing one would mean either publishing
uncoordinated rows — which the coordinates-required guard correctly refuses —
or inventing coordinates, which is the one thing this work must never do.

## How to unblock

Any *one* of these is sufficient to move the 35:

1. Allow `*.arcgis.com` and the state DOT GIS hosts above through the egress
   policy for this environment.
2. Allow `geocoding.geo.census.gov` — helps the addressable rows, but **not**
   these 216, for the reason given above.
3. Supply the layers out-of-band as committed files (GeoJSON/CSV) under
   `data/geocoding/`, the way `locmaster20260725.xlsx` and the Census batch
   results already are. This needs no network access at all and is the fastest
   route.

Per-state dataset targets are listed in `SOURCING-QUEUE.md`.
