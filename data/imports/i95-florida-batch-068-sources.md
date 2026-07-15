# Batch 68 — I-95 Florida (Miami → Fort Lauderdale → West Palm Beach → Fort Pierce → Cocoa → Daytona → St. Augustine → Jacksonville → GA line/Yulee): Source Report

Every listing was web-verified during research on **2026-07-15**. No field was invented: anything a source did not state is left blank in the CSV. Coordinates are blank on every row (geocoding is a separate verified workflow). Research method: web search against official brand/operator locators (Love's, Pilot/Flying J, TA/Petro, Sinclair, CAT Scale, state DOT/port-of-entry) as primary sources, with directory/review sites (iExit, Allstays, TruckMap, Find Truck Service, truckstopsandservices.com, coopsareopen.com, state rest-area guides) as secondary confirmation.

- First I-95 batch (East Coast corridor). DEDUP state: 73 existing FL production rows form the avoid-list — but ALL 73 are on the I-75 corridor (Miami-NW/Hialeah Gardens, Naples, Fort Myers, Punta Gorda, Bradenton, Wildwood, Ocala, Lake City, Jasper) plus Alligator Alley, none on the I-95 east coast, so no live collisions expected.
- South (Miami→Fort Pierce): the dense SE-Florida urban stretch (Miami/Fort Lauderdale/West Palm) has essentially no on-highway truck stops — none fabricated; the real cluster is Fort Pierce Exits 129 (Pilot #90, Love's #415) and 131 (Love's #467, Flying J #622), each with a CAT scale, plus Love's truck wash, the Martin County weigh station and two rest areas; corridor mobile tire/towing serve Miami→Fort Pierce. North (Fort Pierce→Jacksonville): Vero Beach TA #197, Cocoa Pilot #88, Ormond Beach Love's #316, the St. Augustine Exit 305 pair (Flying J #626 + Love's #894), the Jacksonville freight node (Pilot #91 + TA #248 at Exit 329, Love's #603/#828, Pilot #1047, Blue Beacon) and the Yulee weigh/ag-inspection stations + Florida Welcome Center at the GA line.
- Cross-segment reconciliation at Fort Pierce (Exit 129, the boundary): Pilot #90, Love's #415 and their two CAT scales were returned by both segments — consolidated once in the South part (which carries the fuller Fort Pierce cluster incl. Exit 131). North retains Vero Beach and everything Exit 147+.
- I-95/I-295 junction stops in Jacksonville (Love's #828 at I-295 Exit 33, Pilot #1047 at I-295 Exit 25) kept as I-95 with the I-295 exit noted. FDOT rest areas/weigh stations use nearest named I-95 locality; milepost sites left exit blank.
- Omitted, not fabricated: I-75/Palmetto (Medley/Hialeah Gardens) and Florida Turnpike facilities; no verifiable truck stops through Miami/Fort Lauderdale/WPB city core; WPB/Ft Lauderdale CDL schools not verifiably on I-95.

- Records in CSV: **54**
- Florida existing production listings loaded for dedup: **73** (all on other corridors); collisions dropped: **0**

## Truck Stops & Travel Centers

### Pilot / ONE9 Travel Center #88 — Cocoa, FL

- **Segment:** B(north)
- **I-80 exit:** 201
- **Verified:** 2026-07-15
- **Source:** Pilot Flying J locator; findfuelstops; truckstopsandservices
- **Left blank (not verifiable from sources):** lat, lng

### Flying J Travel Center #622 — Fort Pierce, FL

- **Segment:** A(south)
- **I-80 exit:** 131
- **Verified:** 2026-07-15
- **Source:** locations.pilotflyingj.com; truckstopsandservices.com
- **Left blank (not verifiable from sources):** lat, lng

### Love's Travel Stop #415 — Fort Pierce, FL

- **Segment:** A(south)
- **I-80 exit:** 129
- **Verified:** 2026-07-15
- **Source:** loves.com/locations/415; truckstopsandservices.com; truckmap.com
- **Left blank (not verifiable from sources):** lat, lng

### Love's Travel Stop #467 — Fort Pierce, FL

- **Segment:** A(south)
- **I-80 exit:** 131B
- **Verified:** 2026-07-15
- **Source:** loves.com/locations/467; truckstopsandservices.com; findtruckservice.com
- **Left blank (not verifiable from sources):** lat, lng

### Pilot Travel Center #90 — Fort Pierce, FL

- **Segment:** A(south)
- **I-80 exit:** 129
- **Verified:** 2026-07-15
- **Source:** locations.pilotflyingj.com; truckstopsandservices.com; findtruckservice.com
- **Left blank (not verifiable from sources):** lat, lng

### Love's Travel Stop #603 — Jacksonville, FL

- **Segment:** B(north)
- **I-80 exit:** 366
- **Verified:** 2026-07-15
- **Source:** loves.com locator; findtruckservice; Love's press release
- **Left blank (not verifiable from sources):** lat, lng

### Love's Travel Stop #828 — Jacksonville, FL

- **Segment:** B(north)
- **I-80 exit:** I-295 Exit 33
- **Verified:** 2026-07-15
- **Source:** loves.com locator; findtruckservice; truckstopsandservices
- **Left blank (not verifiable from sources):** lat, lng

### Pilot Travel Center #1047 — Jacksonville, FL

- **Segment:** B(north)
- **I-80 exit:** I-295 Exit 25
- **Verified:** 2026-07-15
- **Source:** Pilot Flying J locator; findtruckservice; Jax Daily Record
- **Left blank (not verifiable from sources):** lat, lng

### Love's Travel Stop #316 — Ormond Beach, FL

- **Segment:** B(north)
- **I-80 exit:** 273
- **Verified:** 2026-07-15
- **Source:** loves.com locator; truckstopsandservices; Yelp
- **Left blank (not verifiable from sources):** lat, lng

### Sunoco Truck Stop - Palm Bay — Palm Bay, FL

- **Segment:** B(north)
- **I-80 exit:** 173
- **Verified:** 2026-07-15
- **Source:** truckstopsandservices; findfuelstops (I-95 Exit 173)
- **Left blank (not verifiable from sources):** zip, phone, website, lat, lng

### Flying J Travel Center #626 — Saint Augustine, FL

- **Segment:** B(north)
- **I-80 exit:** 305
- **Verified:** 2026-07-15
- **Source:** Pilot Flying J locator; truckstopsandservices
- **Left blank (not verifiable from sources):** phone, lat, lng

### Love's Travel Stop #894 — Saint Augustine, FL

- **Segment:** B(north)
- **I-80 exit:** 305
- **Verified:** 2026-07-15
- **Source:** loves.com locator; findtruckservice; cdllife
- **Left blank (not verifiable from sources):** lat, lng

### Pilot Travel Center #91 — Saint Johns, FL

- **Segment:** B(north)
- **I-80 exit:** 329
- **Verified:** 2026-07-15
- **Source:** Pilot Flying J locator; findfuelstops; findtruckservice
- **Left blank (not verifiable from sources):** lat, lng

### TA Jacksonville South #248 — Saint Johns, FL

- **Segment:** B(north)
- **I-80 exit:** 329
- **Verified:** 2026-07-15
- **Source:** ta-petro.com; Yelp; truckstopsandservices
- **Left blank (not verifiable from sources):** lat, lng

### Gators Truck Stop — Vero Beach, FL

- **Segment:** B(north)
- **I-80 exit:** 147
- **Verified:** 2026-07-15
- **Source:** iExit / allstays directory listing (Vero Beach Exit 147)
- **Left blank (not verifiable from sources):** phone, website, lat, lng

### TA Vero Beach #197 — Vero Beach, FL

- **Segment:** B(north)
- **I-80 exit:** 147
- **Verified:** 2026-07-15
- **Source:** ta-petro.com; findtruckservice; truckstopsandservices
- **Left blank (not verifiable from sources):** lat, lng

## CAT Scales

### CAT Scale at Flying J Fort Pierce — Fort Pierce, FL

- **Segment:** A(south)
- **I-80 exit:** 131
- **Verified:** 2026-07-15
- **Source:** locations.pilotflyingj.com; catscale.com
- **Left blank (not verifiable from sources):** phone, lat, lng

### CAT Scale at Love's Fort Pierce (Exit 129) — Fort Pierce, FL

- **Segment:** A(south)
- **I-80 exit:** 129
- **Verified:** 2026-07-15
- **Source:** loves.com/locations/415; catscale.com
- **Left blank (not verifiable from sources):** phone, lat, lng

### CAT Scale at Love's Fort Pierce (Exit 131) — Fort Pierce, FL

- **Segment:** A(south)
- **I-80 exit:** 131B
- **Verified:** 2026-07-15
- **Source:** loves.com/locations/467; catscale.com
- **Left blank (not verifiable from sources):** phone, lat, lng

### CAT Scale at Pilot Fort Pierce — Fort Pierce, FL

- **Segment:** A(south)
- **I-80 exit:** 129
- **Verified:** 2026-07-15
- **Source:** truckstopsandservices.com; catscale.com
- **Left blank (not verifiable from sources):** phone, lat, lng

### CAT Scale at Love's Jacksonville (Pecan Park) — Jacksonville, FL

- **Segment:** B(north)
- **I-80 exit:** 366
- **Verified:** 2026-07-15
- **Source:** loves.com locator; truckerpath; CAT Scale locator
- **Left blank (not verifiable from sources):** phone, lat, lng

### CAT Scale at Love's Ormond Beach — Ormond Beach, FL

- **Segment:** B(north)
- **I-80 exit:** 273
- **Verified:** 2026-07-15
- **Source:** loves.com locator; CAT Scale locator
- **Left blank (not verifiable from sources):** phone, lat, lng

### CAT Scale at Flying J Saint Augustine — Saint Augustine, FL

- **Segment:** B(north)
- **I-80 exit:** 305
- **Verified:** 2026-07-15
- **Source:** Pilot Flying J locator; CAT Scale locator
- **Left blank (not verifiable from sources):** phone, lat, lng

### CAT Scale at TA Jacksonville South — Saint Johns, FL

- **Segment:** B(north)
- **I-80 exit:** 329
- **Verified:** 2026-07-15
- **Source:** ta-petro.com; CAT Scale locator
- **Left blank (not verifiable from sources):** phone, lat, lng

### CAT Scale at TA Vero Beach — Vero Beach, FL

- **Segment:** B(north)
- **I-80 exit:** 147
- **Verified:** 2026-07-15
- **Source:** ta-petro.com; findtruckservice
- **Left blank (not verifiable from sources):** phone, lat, lng

## Tire & Repair

### Southern Tire & Fleet Service — Jacksonville, FL

- **Segment:** B(north)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** southerntirejax.com; findtruckservice; Yelp
- **Left blank (not verifiable from sources):** zip, exit_number, lat, lng

### TD Commercial Tire — Jacksonville, FL

- **Segment:** B(north)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** tdtires.com
- **Left blank (not verifiable from sources):** phone, exit_number, lat, lng

### TA Truck Service - Jacksonville South — Saint Johns, FL

- **Segment:** B(north)
- **I-80 exit:** 329
- **Verified:** 2026-07-15
- **Source:** ta-petro.com; Yelp
- **Left blank (not verifiable from sources):** lat, lng

### Martino Commercial Tire — West Palm Beach, FL

- **Segment:** A(south)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** martinotire.com; michelinman.com dealer locator; yelp.com
- **Left blank (not verifiable from sources):** zip, exit_number, lat, lng

### Pat's Tire — West Palm Beach, FL

- **Segment:** A(south)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** patstires.com; yelp.com; yellowpages.com
- **Left blank (not verifiable from sources):** exit_number, lat, lng

## Roadside Service

### ASAP Towing & Storage — Jacksonville, FL

- **Segment:** B(north)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** asaptowing.net; 4roadservice
- **Left blank (not verifiable from sources):** address, zip, exit_number, lat, lng

### All Truck Service - Jacksonville — Jacksonville, FL

- **Segment:** B(north)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** alltruckservice.com
- **Left blank (not verifiable from sources):** address, zip, exit_number, lat, lng

### JAX24 Mobile Semi Truck Repair — Jacksonville, FL

- **Segment:** B(north)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** jaxtruckservice.com; 4roadservice
- **Left blank (not verifiable from sources):** address, zip, exit_number, lat, lng

### All Hooked Up Towing & Recovery — Jupiter, FL

- **Segment:** A(south)
- **I-80 exit:** 87A
- **Verified:** 2026-07-15
- **Source:** allhookeduptowing.com; bbb.org
- **Left blank (not verifiable from sources):** lat, lng

### American Towing Service - Miami — Miami, FL

- **Segment:** A(south)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** americantowingflorida.com
- **Left blank (not verifiable from sources):** address, zip, exit_number, lat, lng

### C&P Towing and Transport — Pompano Beach, FL

- **Segment:** A(south)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** cpautogroup.com
- **Left blank (not verifiable from sources):** address, zip, exit_number, lat, lng

### Albert's Road Service — West Palm Beach, FL

- **Segment:** A(south)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** albertsroadservice.com
- **Left blank (not verifiable from sources):** address, zip, exit_number, lat, lng

## Truck Parking

### St. Lucie County Rest Area (I-95 MM 133) — Fort Pierce, FL

- **Segment:** A(south)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** floridarestareas.com; fdot.gov; iexitapp.com. City recorded as Fort Pierce, the nearest named I-95 locality.
- **Left blank (not verifiable from sources):** address, phone, exit_number, lat, lng

### St. Johns County Rest Area (I-95 MM 331) — Jacksonville, FL

- **Segment:** B(north)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** FDOT rest area info; floridarestareas.com. City recorded as Jacksonville/St. Johns, the nearest named I-95 locality.
- **Left blank (not verifiable from sources):** address, zip, phone, exit_number, lat, lng

### Brevard County Rest Area (I-95 MM 168, Palm Bay) — Palm Bay, FL

- **Segment:** B(north)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** FDOT rest area info; floridarestareas.com. City recorded as Palm Bay, the nearest named I-95 locality.
- **Left blank (not verifiable from sources):** address, zip, phone, exit_number, lat, lng

### St. Johns County Rest Area (I-95 MM 302) — Saint Augustine, FL

- **Segment:** B(north)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** FDOT rest area info; floridarestareas.com. City recorded as St. Augustine, the nearest named I-95 locality.
- **Left blank (not verifiable from sources):** address, zip, phone, exit_number, lat, lng

### Martin County Rest Area (I-95 MM 106) — Stuart, FL

- **Segment:** A(south)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** floridarestareas.com; fdot.gov; rvparky.com. City recorded as Stuart, the nearest named I-95 locality.
- **Left blank (not verifiable from sources):** address, zip, phone, exit_number, lat, lng

### Brevard County Rest Area (I-95 MM 225, Titusville) — Titusville, FL

- **Segment:** B(north)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** FDOT rest area info; cflroads.com; floridarestareas.com. City recorded as Titusville, the nearest named I-95 locality.
- **Left blank (not verifiable from sources):** address, zip, phone, exit_number, lat, lng

### Florida Welcome Center (I-95) — Yulee, FL

- **Segment:** B(north)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** FDOT rest area info; VISIT FLORIDA; floridarestareas.com. City recorded as Yulee, the nearest named I-95 locality.
- **Left blank (not verifiable from sources):** address, zip, phone, exit_number, lat, lng

## Truck Washes

### Love's Truck Wash - Fort Pierce — Fort Pierce, FL

- **Segment:** A(south)
- **I-80 exit:** 129
- **Verified:** 2026-07-15
- **Source:** loves.com/locations/415; truckstopsandservices.com
- **Left blank (not verifiable from sources):** lat, lng

### Blue Beacon Truck Wash - Jacksonville — Jacksonville, FL

- **Segment:** B(north)
- **I-80 exit:** I-295 Exit 25
- **Verified:** 2026-07-15
- **Source:** bluebeacon.com locator; Jax Daily Record
- **Left blank (not verifiable from sources):** lat, lng

## Weigh Stations

### Martin County Weigh Station (I-95 Southbound) — Palm City, FL

- **Segment:** A(south)
- **I-80 exit:** 114
- **Verified:** 2026-07-15
- **Source:** fdot.gov/mcsaw; conegraham.com; floridarestareas.com
- **Left blank (not verifiable from sources):** address, zip, phone, lat, lng

### Agricultural Inspection Station No. 16B (I-95) — Yulee, FL

- **Segment:** B(north)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** FDACS Ag Inspection Station 16B page. City recorded as Yulee, the nearest named I-95 locality.
- **Left blank (not verifiable from sources):** address, zip, phone, exit_number, lat, lng

### Nassau County Weigh Station (I-95) — Yulee, FL

- **Segment:** B(north)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** FDOT MCSAW weigh station list; floridarestareas.com. City recorded as Yulee, the nearest named I-95 locality.
- **Left blank (not verifiable from sources):** address, zip, phone, exit_number, lat, lng

## Hotels with Truck Parking

### Days Inn & Suites by Wyndham Fort Pierce I-95 — Fort Pierce, FL

- **Segment:** A(south)
- **I-80 exit:** 129
- **Verified:** 2026-07-15
- **Source:** wyndhamhotels.com; trivago.com; visitstlucie.com
- **Left blank (not verifiable from sources):** phone, lat, lng

