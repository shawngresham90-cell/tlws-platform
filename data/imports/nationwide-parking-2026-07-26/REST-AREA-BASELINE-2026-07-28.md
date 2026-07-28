# Rest-area / weigh-station baseline — measured 2026-07-28 (read-only)

Fresh audit after the operator closeout run. **No agency-derived database
write was made**: the repository holds no official DOT/FHWA/BTS artifact
(verified — `data/sources/` contains only the three operator masters and
the license-gated AllStays discovery set), so gate lines 5–6 remain
intake-blocked, not execution-blocked. The intake process, import templates
(`ENRICH-TEMPLATE.sql`, `PUBLISH-TEMPLATE.sql`, `ROLLBACK-TEMPLATE.sql`,
`RECONCILE.sql`) and validation queries already exist in this directory.

## What the directory holds today (all `csv-import` legacy, zero official provenance)

| Layer | Live | Published | Published + mappable | Notes |
|---|--:|--:|--:|---|
| `parking` category | 167 | 76 | **31** | 78 rows are *named* like public rest facilities (rest area / welcome center / service plaza) — 11 published, **0 with coordinates** |
| `weigh-stations` category | 59 | 13 | **4** | 0 parking-space claims (correct — never parking) |
| Rest-area / welcome-center / service-plaza category | — | — | — | **does not exist**; the 78 named rows sit inside `parking` |

Every row in both layers carries `source = csv-import` and no geocode
provenance. None can be counted against gate lines 5–6, which are measured
against official agency datasets.

## Priority-corridor coverage after the operator closeout (published + mappable + positive spaces)

| Corridor | Today | vs. registry's snapshot |
|---|--:|--:|
| I-10 | **115** | was 23 |
| I-80 | **99** | was 28 |
| I-90 | **73** | was 27 (I-90/94 combined) |
| I-95 | **64** | was 4 |
| I-94 | **43** | — |
| I-15 | **41** | was 7 |

The operator lines transformed corridor depth, so `AGENCY-REGISTRY.md`'s
computed weights (built when I-95 had 4 rows) are stale. The re-ranking
below uses today's numbers **plus** the fact that six jurisdictions still
have **zero confirmed truck parking of any kind: AK, DE, HI, ME, VT, DC** —
no operator line will ever fix those; only agency data can.

## The first five datasets to obtain (refreshed ranking)

Ranked by: closes zero-coverage jurisdictions first, then thinnest priority
corridor per request, then breadth per single request. Every URL is a
canonical entry point, **unverified from this environment** (agency hosts
are blocked at egress); confirm on arrival. Do not treat search snippets as
data — download the file, checksum it, reconcile it.

| # | Dataset | Agency | Why first | Entry point (unverified) | Expected format | Required columns | Stable ID | Cadence / license |
|--:|---|---|---|---|---|---|---|---|
| 1 | **National truck-parking layer (Jason's Law survey)** | FHWA / BTS | One artifact covers all 50 states + DC, incl. AK/HI; only single-file mover for line 5 | https://geodata.bts.gov (search "Truck Stop Parking") | GeoJSON / SHP / CSV | facility name, type, lat, lng, state, route, truck spaces | BTS object ID | Irregular; public domain (cite BTS vintage) |
| 2 | **New England rest areas (ME + VT + MA + NH)** | MaineDOT · VTrans · MassDOT | Closes 2 of the 6 zero-coverage states and thickens I-95 NE | https://www.maine.gov/mdot/gis/ · https://vtrans.vermont.gov (open data) | SHP / CSV | name, direction, route, mile, lat, lng, truck spaces, facilities | state asset ID | Annual-ish; state open-data terms |
| 3 | **DelDOT rest/welcome facilities + DC** | Delaware DOT (+ DDOT) | Closes DE and DC; I-95 spine | https://opendata.deldot.gov | GeoJSON / CSV | name, route, direction, lat, lng, truck spaces | DelDOT asset ID | Updated with portal; open license |
| 4 | **PennDOT roadside rest areas / welcome centers** | Pennsylvania DOT | Largest single I-95/I-80/I-90 multiplier (registry Tier-1 #1) | https://data.pa.gov / PennDOT open data (PennShare) | SHP / CSV | site name, route, segment, direction, lat, lng, truck parking | PennDOT site ID | Annual; open records |
| 5 | **Alaska + Hawaii DOT facility layers** | Alaska DOT&PF · HDOT | The last two zero-coverage states; small files, one request each | https://dot.alaska.gov (GIS portal) · https://histategis.maps.arcgis.com | GeoJSON / SHP | name, route, lat, lng, facility type | state asset ID | Irregular; public records |

Weigh stations (line 6) ride along: every dataset above that includes
weigh/inspection facilities gets classified **separately** into
`weigh-stations`, never as parking, per the standing rule.

## Intake contract (unchanged)

Each artifact, on arrival: checksum → record in `SOURCE-ACQUISITION.md` +
`source-acquisition.json` → reconcile against live rows (`RECONCILE.sql`) →
guarded insert/enrich from the templates with per-state transactions,
collision guards and prepared rollback → publish only rows with official
coordinates and an explicit truck-parking status; weigh stations and
zero/unknown-parking facilities are directory-only. The 78 legacy
rest-facility-named `parking` rows are candidates for reconciliation (not
trust) once official data exists.
