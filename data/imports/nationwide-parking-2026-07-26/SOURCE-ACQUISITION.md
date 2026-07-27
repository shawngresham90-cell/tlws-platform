# Source acquisition — what Shawn must obtain

Seven external sources close the launch gate. Nothing in this list can be
fetched from the build environment: the agency endpoints are blocked by network
policy, and the operator feeds require authorization that is Shawn's to give,
not something to take.

**No URL below was fetched or verified during this run.** Each is the canonical
entry point to start from; confirm the exact download path on arrival, because
operator sites reorganise. The machine-readable companion is
`source-acquisition.json`.

**Do not scrape.** In particular, Truck Parking Club's inventory must not be
reproduced without an authorized feed — see source 1.

---

## Start here

> ### Obtain **Love's Travel Stops** first.
> `https://www.loves.com/en/location-search` → their published location export;
> if no direct download is offered, request it via Love's fleet/business
> contact on the same site.
>
> **Why first:** it is the single largest closable gate line. Love's is one
> operator with one authoritative file covering ~650 sites nationwide, it needs
> no per-state work, and it lands coordinates on corridors where the directory
> currently has nothing — I-80, I-90/I-94, I-10 and I-15 all hold zero rows
> today. It also directly resolves a live inconsistency: 369 held-brand rows
> already sit in the database, 273 of them published, with no authoritative
> backing.
>
> One file, one gate line from 0 % to 100 %, and the widest corridor reach of
> anything on this list.

Then, in order: Pilot/Flying J/ONE9 → TA/Petro/TA Express → FHWA GIS →
state DOT rest areas → weigh stations → Truck Parking Club (authorization
permitting, and it may arrive at any point).

---

## 1. Truck Parking Club — authorized feed

| | |
|---|---|
| **Source ID** | `tpc-feed` |
| **URL / contact** | `https://www.truckparkingclub.com` — partnership/API contact. **Authorization required before any use.** |
| **Format** | CSV or JSON API export, per agreement |
| **Represents** | **Parking** (private, bookable) |
| **Priority** | 7 — gated on authorization, not on effort |
| **Required columns** | location id · name · street · city · state · zip · latitude · longitude · space count · amenities · access hours · booking URL · active/closed flag |
| **Stable ID** | provider location id → `source_ref` |
| **Attribution / licence** | per agreement; expect attribution and a redistribution limit. Record the agreement reference in the manifest. |
| **Update frequency** | expect frequent — treat as a living feed, re-pull at the agreed cadence |
| **Closure signal** | active/closed flag, or absence from a later full export |
| **Deduplication** | `source_ref` first; then coordinate proximity < 150 m + canonical name. Several existing rows already name this brand (AR, IL, MI ×2, NC) and are currently quarantined `no-official-source` — the feed either confirms and replaces them, or they stay quarantined. |

**Constraint:** without a signed feed, this source stays at 0 % and the gate
stays closed. Do not substitute scraped listings, and do not infer inventory
from their public map.

## 2. Love's Travel Stops

| | |
|---|---|
| **Source ID** | `loves-master` |
| **URL** | `https://www.loves.com/en/location-search` (published location export; else fleet/business contact) |
| **Format** | Excel (`.xlsx`) expected |
| **Represents** | **Truck stop** (with parking attributes) |
| **Priority** | **1 — obtain first** |
| **Required columns** | store number · name · street · city · state · zip · latitude · longitude · truck parking spaces · showers · scales · open date · status |
| **Stable ID** | Love's store number |
| **Attribution / licence** | operator data — confirm redistribution terms before publishing counts |
| **Update frequency** | monthly-ish; new builds and closures are routine |
| **Closure signal** | status column, or disappearance between exports |
| **Deduplication** | store number first; then coordinate proximity + name. **369 held-brand rows already exist, 273 published** — this file is what turns those into verified records rather than unverified ones. |

## 3. Pilot / Flying J / ONE9

| | |
|---|---|
| **Source ID** | `pilot-master` |
| **URL** | `https://pilotflyingj.com/locations` (complete-location download; else their fleet contact) |
| **Format** | Excel or CSV expected |
| **Represents** | **Truck stop** (with parking attributes) |
| **Priority** | 2 |
| **Required columns** | site number · brand (Pilot / Flying J / ONE9) · name · street · city · state · zip · latitude · longitude · truck parking spaces · showers · scales · status |
| **Stable ID** | Pilot site number |
| **Attribution / licence** | operator data — confirm redistribution terms |
| **Update frequency** | monthly-ish |
| **Closure signal** | status column or absence from a later export |
| **Deduplication** | site number; then proximity + name. **Brand must be preserved** — ONE9 is a distinct format and must not be flattened into "Pilot". |

## 4. TA / Petro / TA Express

| | |
|---|---|
| **Source ID** | `ta-master` |
| **URL** | `https://www.ta-petro.com/locations` (master export; else their fleet contact) |
| **Format** | Excel or CSV expected |
| **Represents** | **Truck stop** (with parking attributes) |
| **Priority** | 3 |
| **Required columns** | site number · brand (TA / Petro / TA Express) · name · street · city · state · zip · latitude · longitude · truck parking spaces · showers · scales · status |
| **Stable ID** | TA site number |
| **Attribution / licence** | operator data — confirm redistribution terms |
| **Update frequency** | monthly-ish |
| **Closure signal** | status column or absence |
| **Deduplication** | site number; then proximity + name. The repo already holds `data/imports/locmaster20260725.xlsx` — **treat it as stale until re-obtained**, and reconcile against the fresh export rather than trusting it. |

## 5. FHWA public truck-parking GIS

| | |
|---|---|
| **Source ID** | `fhwa-truck-parking` |
| **URL** | USDOT/BTS open data portal (`data.transportation.gov`) — the national truck parking layer arising from the Jason's Law survey. **Blocked from this environment; download locally.** |
| **Format** | Shapefile or GeoJSON |
| **Represents** | **Parking** (public), plus some private sites |
| **Priority** | 4 |
| **Required columns** | facility id · name · state · route · direction · milepost · latitude · longitude · truck spaces · ownership (public/private) · facility type |
| **Stable ID** | FHWA/BTS facility id |
| **Attribution / licence** | US federal government — public domain; attribute the agency and the vintage |
| **Update frequency** | infrequent, survey-driven — **record the vintage**, it can be several years old |
| **Closure signal** | none reliable; a stale federal layer must never override a fresher state dataset |
| **Deduplication** | facility id; then proximity < 150 m against state DOT rows. **State DOT wins on conflict** — it is closer to the asset. |

## 6. State DOT rest areas / welcome centers / service plazas

| | |
|---|---|
| **Source ID** | `statedot-restareas` (one file per state, suffixed `-<ST>`) |
| **URL** | per state — the ranked worklist is in `SOURCING-QUEUE.md`. **All blocked from this environment.** |
| **Format** | Shapefile / GeoJSON / ArcGIS FeatureServer JSON / CSV — varies by state |
| **Represents** | **Rest area**, **welcome center**, or **service plaza** — must be distinguished, not merged |
| **Priority** | 5 — start with VA, FL, TN, MD, SC (35 pending rows resolve immediately) |
| **Required columns** | facility id · name · type · state · route · direction · milepost/exit · latitude · longitude · **truck spaces** · hours/seasonal restrictions · amenities · status |
| **Stable ID** | state facility id, namespaced by state |
| **Attribution / licence** | usually open state data; check each state's terms |
| **Update frequency** | annual-ish, plus closures for construction |
| **Closure signal** | status column; seasonal closures matter to a driver and must be carried, not dropped |
| **Deduplication** | state facility id; then proximity + name. **Directional pairs stay separate** — 8 such pairs are already identified and must each receive their own coordinate. |

**This is the source that unblocks the 35 `A-PENDING-COORDINATE` rows.** It is
also the only source that can confirm the truck-parking status the gate
requires for line 5 — a rest area is not automatically truck parking.

## 7. Official weigh stations

| | |
|---|---|
| **Source ID** | `weigh-stations` (per state, suffixed `-<ST>`) |
| **URL** | state DOT or state police / CVE division, per state. **Blocked from this environment.** |
| **Format** | Shapefile / GeoJSON / CSV |
| **Represents** | **Weigh station** — a separate category, never parking |
| **Priority** | 6 |
| **Required columns** | station id · name · state · route · direction · milepost · latitude · longitude · **parking permitted (explicit)** · hours of operation · bypass programme · status |
| **Stable ID** | state station id |
| **Attribution / licence** | usually open state data; check each state |
| **Update frequency** | infrequent; closures and conversions do happen (TDOT converted two on I-65 to truck parking) |
| **Closure signal** | status column; a converted site must be **re-typed as parking**, not deleted |
| **Deduplication** | station id; then proximity + name. 8 directional weigh pairs are already identified. |

**Gate line 6 is 100 % as a separate category.** A weigh station only becomes
parking if this dataset explicitly says parking is permitted.

---

## What must not happen

- No scraping of Truck Parking Club, or of any operator's map, in place of an
  authorized export.
- No coordinate from a road midpoint, ZIP centroid, interpolation, geocoder
  guess, or search-result snippet.
- No invented space count, hours, restriction or amenity. A field the source
  does not state stays `null`.
- No parser written before the real file is in hand. Column names above are the
  **requirement to check on arrival**, not a schema to code against.
- No production write, and no publication, without a separate authorization.
