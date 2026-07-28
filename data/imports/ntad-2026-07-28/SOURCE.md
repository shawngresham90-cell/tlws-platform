# NTAD Truck Stop Parking — source and checksum record (2026-07-28)

## The file

- Dataset: **NTAD Truck Stop Parking, 2017–Present** (Jason's Law survey
  layers, FHWA via BTS). Official record: ROSA-P `dot:88314`
  (<https://rosap.ntl.bts.gov/view/dot/88314>).
- Archive: `dot_88314_DS1.zip`, 776,417 bytes, owner-supplied 2026-07-28.
- **SHA-256:** `d32ebfebb0b84f68057be9d949d9ef13db3da014647042c75329aaf12a762b42`
- **SHA-512:** `d4542356739bc9a2569d166b5edb969867703d474ffbec1f069812c0953c95b6180386fad6b441fc405d3c934f2ecc72ba1b0f0f558b5c03136bb73292dd4f7d`
  — matches the BTS record byte-for-byte (verified at intake and re-verified
  for this package).

## Contents (verified at intake, 2026-07-28)

| GDB | Layer | Features | CRS | Vintage |
|---|---|---|---|---|
| NTAD2017 | `truck_stop_parking_2014_08_12` | 8,271 | EPSG:3857 | 2014-08-12 |
| NTAD2020 | `truck_stop_parking_2019_04_09_v01…v04` | 1,915 ×4 (content-identical) | EPSG:3857 | **2019-04-09** |

**Canonical baseline: the 2019 `v04` layer.** The 2017 layer is historical
context only (6,376 of its rows are anonymous zero-count private points;
359 of its public facilities vanished by the 2019 survey — demonstrated
churn).

## Authority and currency

- **Authoritative:** yes — the official FHWA/BTS Jason's Law layer, public
  domain, checksum-verified.
- **Current: NO.** Vintage 2019-04-09. **No NTAD fact — name, status,
  parking count, or amenity — is treated as current operating proof by
  itself.** Every canary fact below is labeled `STATE-CONFIRMED (2026)`,
  `NTAD-2019`, or `UNKNOWN`, and only STATE-CONFIRMED facts gate
  imports.
- **Newer-survey check (2026-07-28):** search of ops.fhwa.dot.gov, bts.gov,
  geodata.bts.gov, transportation.gov found **no third Jason's Law survey
  dataset published** — the newest official federal layer remains the
  2019 survey in this archive. Re-check at each future import phase.

## No stable source ID

`state + state_number` is not unique (48 duplicate keys); layer FIDs are
ordinals. Dedup keys used instead: normalized identity + state +
coordinate proximity. Future refreshes must re-match on those.

## Datasets identified for the jurisdictions NTAD cannot cover

| Jurisdiction | NTAD rows | Official channel identified (2026-07-28) |
|---|--:|---|
| Alaska | 0 | Alaska DOT&PF highways portal (`dot.alaska.gov/highways-portal.shtml`); no specific rest-area layer surfaced by domain-restricted search — requires direct portal navigation or DOT&PF contact for the facilities list/GIS layer |
| Hawaii | 0 | HDOT Highways Division (`hidot.hawaii.gov/highways/`) + Hawaii Open Data geospatial group (`opendata.hawaii.gov`); no rest-area layer surfaced by search — same follow-up needed |
| Washington, DC | 0 | DDOT **District Freight Plan 2024** (`ddot.dc.gov` full-report PDF, 2024-06-03) + `freight.ddot.dc.gov`. Search indicates DC's freight program covers loading zones/routing and **no dedicated public truck-parking rest areas** — the human click-through of the 2024 Freight Plan can close DC as confirmed-absence rather than a data gap |

Bonus discovery for California: Caltrans publishes a **current official
statewide Safety Roadside Rest Area GIS dataset** (`data.ca.gov` /
`caltrans-gis.dot.ca.gov` Rest_Areas FeatureServer, plus
`quickmap.dot.ca.gov/data/srra.kml`) — recommended to supersede NTAD's 83
California rows entirely at the statewide phase.
