# Batch 53 — I-80 Ohio (Indiana line → Ohio Turnpike/Toledo → Elyria I-90 split → Youngstown → Girard → Hubbard/PA line): Source Report

Every listing was web-verified during research on **2026-07-15**. No field was invented: anything a source did not state is left blank in the CSV. Coordinates are blank on every row (geocoding is a separate verified workflow). Research method: web search against official brand/operator locators (Love's, Pilot/Flying J, TA/Petro, Sinclair, CAT Scale, state DOT/port-of-entry) as primary sources, with directory/review sites (iExit, Allstays, TruckMap, Find Truck Service, truckstopsandservices.com, coopsareopen.com, state rest-area guides) as secondary confirmation.

- Ohio already has 95 production rows (all on I-75); this batch was compiled against all 95 live importDupKey keys.
- I-80 in Ohio is the Ohio Turnpike (concurrent with I-90 from the Indiana line to the Elyria/I-90 split near Exit 142), then continues as the Turnpike alone and finally as free I-80 east of Exit 218 through Youngstown/Girard/Hubbard to the PA line. Interstate recorded as I-80; Turnpike service plazas use milepost labels in exit_number.
- West (IN line → Amherst MP139/Elyria) and East (Broadview Heights MP170 → PA line) are disjoint across the I-90 split — no cross-segment overlap. The generic Perrysburg Pilot/Flying J were renamed with a city suffix; note Perrysburg also sits on I-75, so any name|city collision with the live I-75 set is dropped by the avoid-list.
- Omitted, not fabricated: Glacier Hills/Mahoning Valley plazas (MP237, on the I-76 portion east of the Exit 218 split, not I-80); Middle Ridge/Vermilion Valley belong to the West segment; no 'Fallen Timbers' plaza exists on the current Turnpike list.

- Records in CSV: **44**
- Ohio existing production listings loaded for dedup: **95** (all on other corridors); collisions dropped: **0**

## Truck Stops & Travel Centers

### Middle Ridge Service Plaza — Amherst, OH

- **Segment:** A(west)
- **I-80 exit:** MP 139
- **Verified:** 2026-07-15
- **Source:** ohioturnpike.org/truckers/service-plazas/middle-ridge
- **Left blank (not verifiable from sources):** address, zip, phone, lat, lng

### Vermilion Valley Service Plaza — Amherst, OH

- **Segment:** A(west)
- **I-80 exit:** MP 139
- **Verified:** 2026-07-15
- **Source:** ohioturnpike.org/truckers/service-plazas/vermilion-valley
- **Left blank (not verifiable from sources):** address, zip, phone, lat, lng

### Great Lakes Service Plaza (Westbound) — Broadview Heights, OH

- **Segment:** B(east)
- **I-80 exit:** MP 170 WB
- **Verified:** 2026-07-15
- **Source:** ohioturnpike.org; Yelp/ohiorestareas (I-80 MM170)
- **Left blank (not verifiable from sources):** address, phone, lat, lng

### Towpath Service Plaza (Eastbound) — Broadview Heights, OH

- **Segment:** B(east)
- **I-80 exit:** MP 170 EB
- **Verified:** 2026-07-15
- **Source:** ohioturnpike.org; ohiorestareas.com (I-80 MM170)
- **Left blank (not verifiable from sources):** phone, lat, lng

### Commodore Perry Service Plaza — Clyde, OH

- **Segment:** A(west)
- **I-80 exit:** MP 100
- **Verified:** 2026-07-15
- **Source:** ohioturnpike.org/truckers/service-plazas/commodore-perry
- **Left blank (not verifiable from sources):** address, zip, phone, lat, lng

### Erie Islands Service Plaza — Clyde, OH

- **Segment:** A(west)
- **I-80 exit:** MP 100
- **Verified:** 2026-07-15
- **Source:** ohioturnpike.org service plazas; ohiorestareas.com
- **Left blank (not verifiable from sources):** address, zip, phone, lat, lng

### Blue Heron Service Plaza — Genoa, OH

- **Segment:** A(west)
- **I-80 exit:** MP 77
- **Verified:** 2026-07-15
- **Source:** ohioturnpike.org/truckers/service-plazas/blue-heron; turnpikeinfo.com
- **Left blank (not verifiable from sources):** address, zip, phone, lat, lng

### Wyandot Service Plaza — Genoa, OH

- **Segment:** A(west)
- **I-80 exit:** MP 77
- **Verified:** 2026-07-15
- **Source:** ohioturnpike.org service plazas; turnpikeinfo.com (77_eb_plaz)
- **Left blank (not verifiable from sources):** address, zip, phone, lat, lng

### Petro Stopping Center Girard #320 — Girard, OH

- **Segment:** B(east)
- **I-80 exit:** 226
- **Verified:** 2026-07-15
- **Source:** ta-petro.com; truckstopsandservices.com (I-80 Exit 226)
- **Left blank (not verifiable from sources):** lat, lng

### Pilot Travel Center #281 (Girard) — Girard, OH

- **Segment:** B(east)
- **I-80 exit:** 226
- **Verified:** 2026-07-15
- **Source:** pilotflyingj.com; truckstopsandservices.com (I-80 Exit 226)
- **Left blank (not verifiable from sources):** lat, lng

### Flying J Travel Center #697 (Hubbard) — Hubbard, OH

- **Segment:** B(east)
- **I-80 exit:** 234B
- **Verified:** 2026-07-15
- **Source:** pilotflyingj.com; roadrescuenetwork.com (I-80 Exit 234)
- **Left blank (not verifiable from sources):** phone, lat, lng

### Love's Travel Stop #370 (Hubbard) — Hubbard, OH

- **Segment:** B(east)
- **I-80 exit:** 234A
- **Verified:** 2026-07-15
- **Source:** truckstopsandservices.com; Yelp (I-80 Exit 234)
- **Left blank (not verifiable from sources):** lat, lng

### Truck World — Hubbard, OH

- **Segment:** B(east)
- **I-80 exit:** 234
- **Verified:** 2026-07-15
- **Source:** truckworldinc.com; iExit (I-80 Exit 234)
- **Left blank (not verifiable from sources):** phone, lat, lng

### Brady's Leap Service Plaza (Eastbound) — Mantua, OH

- **Segment:** B(east)
- **I-80 exit:** MP 197 EB
- **Verified:** 2026-07-15
- **Source:** ohioturnpike.org; ohiorestareas.com (I-80 MM197 EB)
- **Left blank (not verifiable from sources):** address, zip, phone, lat, lng

### Portage Service Plaza (Westbound) — Mantua, OH

- **Segment:** B(east)
- **I-80 exit:** MP 197 WB
- **Verified:** 2026-07-15
- **Source:** ohioturnpike.org; ohiorestareas.com (I-80 MM197 WB)
- **Left blank (not verifiable from sources):** address, zip, phone, lat, lng

### Flying J Travel Center - Perrysburg — Perrysburg, OH

- **Segment:** A(west)
- **I-80 exit:** 71
- **Verified:** 2026-07-15
- **Source:** locations.pilotflyingj.com; CAT Scale list (26415 Warns)
- **Left blank (not verifiable from sources):** lat, lng

### Petro Perrysburg — Perrysburg, OH

- **Segment:** A(west)
- **I-80 exit:** 71
- **Verified:** 2026-07-15
- **Source:** ta-petro.com; findfuelstops.com; CAT Scale list (26416 Baker)
- **Left blank (not verifiable from sources):** phone, lat, lng

### Pilot Travel Center - Perrysburg — Perrysburg, OH

- **Segment:** A(west)
- **I-80 exit:** 71
- **Verified:** 2026-07-15
- **Source:** locations.pilotflyingj.com; CAT Scale list (3430 Libbey)
- **Left blank (not verifiable from sources):** lat, lng

### TA Toledo — Perrysburg, OH

- **Segment:** A(west)
- **I-80 exit:** 71
- **Verified:** 2026-07-15
- **Source:** ta-petro.com; truckstopsandservices.com (Exit 71); CAT Scale list
- **Left blank (not verifiable from sources):** lat, lng

### Love's Travel Stop #456 — Stony Ridge, OH

- **Segment:** A(west)
- **I-80 exit:** 71
- **Verified:** 2026-07-15
- **Source:** loves.com location 456; allstays.com
- **Left blank (not verifiable from sources):** lat, lng

### Indian Meadow Service Plaza — West Unity, OH

- **Segment:** A(west)
- **I-80 exit:** MP 21
- **Verified:** 2026-07-15
- **Source:** ohioturnpike.org service plazas; ohiorestareas.com
- **Left blank (not verifiable from sources):** address, zip, phone, lat, lng

### Tiffin River Service Plaza — West Unity, OH

- **Segment:** A(west)
- **I-80 exit:** MP 21
- **Verified:** 2026-07-15
- **Source:** ohioturnpike.org/truckers/service-plazas/tiffin-river; ohiorestareas.com
- **Left blank (not verifiable from sources):** address, zip, phone, lat, lng

### Pilot Travel Center #3 (Austintown) — Youngstown, OH

- **Segment:** B(east)
- **I-80 exit:** 223
- **Verified:** 2026-07-15
- **Source:** pilotflyingj.com; truckstopsandservices.com (I-80 Exit 223)
- **Left blank (not verifiable from sources):** lat, lng

### TA Travel Center Youngstown #058 — Youngstown, OH

- **Segment:** B(east)
- **I-80 exit:** 223A
- **Verified:** 2026-07-15
- **Source:** ta-petro.com; iExit (I-80 Exit 223A)
- **Left blank (not verifiable from sources):** lat, lng

## CAT Scales

### Petro Girard #320 - CAT Scale — Girard, OH

- **Segment:** B(east)
- **I-80 exit:** 226
- **Verified:** 2026-07-15
- **Source:** CAT Scale locator; ta-petro.com
- **Left blank (not verifiable from sources):** lat, lng

### Pilot #281 - CAT Scale — Girard, OH

- **Segment:** B(east)
- **I-80 exit:** 226
- **Verified:** 2026-07-15
- **Source:** CAT Scale locator; truckstopsandservices.com
- **Left blank (not verifiable from sources):** lat, lng

### Love's #370 - CAT Scale — Hubbard, OH

- **Segment:** B(east)
- **I-80 exit:** 234A
- **Verified:** 2026-07-15
- **Source:** CAT Scale locator; truckstopsandservices.com
- **Left blank (not verifiable from sources):** lat, lng

### CAT Scale - Flying J Perrysburg — Perrysburg, OH

- **Segment:** A(west)
- **I-80 exit:** 71
- **Verified:** 2026-07-15
- **Source:** catscale.com locator; truckstopsandservices.com CAT list
- **Left blank (not verifiable from sources):** phone, lat, lng

### CAT Scale - Petro Perrysburg — Perrysburg, OH

- **Segment:** A(west)
- **I-80 exit:** 71
- **Verified:** 2026-07-15
- **Source:** catscale.com locator; truckstopsandservices.com CAT list
- **Left blank (not verifiable from sources):** phone, lat, lng

### CAT Scale - Pilot Perrysburg — Perrysburg, OH

- **Segment:** A(west)
- **I-80 exit:** 71
- **Verified:** 2026-07-15
- **Source:** catscale.com locator; truckstopsandservices.com CAT list
- **Left blank (not verifiable from sources):** phone, lat, lng

### CAT Scale - TA Toledo — Perrysburg, OH

- **Segment:** A(west)
- **I-80 exit:** 71
- **Verified:** 2026-07-15
- **Source:** catscale.com locator; truckstopsandservices.com CAT list
- **Left blank (not verifiable from sources):** phone, lat, lng

### Pilot Travel Center #3 - CAT Scale — Youngstown, OH

- **Segment:** B(east)
- **I-80 exit:** 223
- **Verified:** 2026-07-15
- **Source:** CAT Scale locator; truckstopsandservices.com
- **Left blank (not verifiable from sources):** lat, lng

### TA Youngstown #058 - CAT Scale — Youngstown, OH

- **Segment:** B(east)
- **I-80 exit:** 223A
- **Verified:** 2026-07-15
- **Source:** CAT Scale locator; ta-petro.com
- **Left blank (not verifiable from sources):** lat, lng

## Tire & Repair

### TA Truck Service - Petro Girard — Girard, OH

- **Segment:** B(east)
- **I-80 exit:** 226
- **Verified:** 2026-07-15
- **Source:** ta-petro.com (Petro Girard truck service)
- **Left blank (not verifiable from sources):** lat, lng

### Love's Tire Care - Hubbard #370 — Hubbard, OH

- **Segment:** B(east)
- **I-80 exit:** 234A
- **Verified:** 2026-07-15
- **Source:** truckstopsandservices.com (Love's #370 tire/truck service)
- **Left blank (not verifiable from sources):** lat, lng

### TA Truck Service - Youngstown #058 — Youngstown, OH

- **Segment:** B(east)
- **I-80 exit:** 223A
- **Verified:** 2026-07-15
- **Source:** ta-petro.com (TA Youngstown truck service)
- **Left blank (not verifiable from sources):** lat, lng

## Roadside Service

### Petro Truck Service - Petro Perrysburg — Perrysburg, OH

- **Segment:** A(west)
- **I-80 exit:** 71
- **Verified:** 2026-07-15
- **Source:** ta-petro.com (Petro Perrysburg)
- **Left blank (not verifiable from sources):** phone, lat, lng

### TA Truck Service - TA Toledo — Perrysburg, OH

- **Segment:** A(west)
- **I-80 exit:** 71
- **Verified:** 2026-07-15
- **Source:** ta-petro.com (TA Toledo truck service bays)
- **Left blank (not verifiable from sources):** lat, lng

### TA Truck Service RoadSquad (Youngstown) — Youngstown, OH

- **Segment:** B(east)
- **I-80 exit:** 223A
- **Verified:** 2026-07-15
- **Source:** ta-petro.com (TA Truck Service / RoadSquad)
- **Left blank (not verifiable from sources):** lat, lng

## Truck Washes

### Blue Beacon Truck Wash of Girard — Girard, OH

- **Segment:** B(east)
- **I-80 exit:** 226
- **Verified:** 2026-07-15
- **Source:** bluebeacon.com; cmac.ws / mechanicadvisor listings
- **Left blank (not verifiable from sources):** lat, lng

### Blue Beacon Truck Wash of Hubbard (Truck World) — Hubbard, OH

- **Segment:** B(east)
- **I-80 exit:** 234
- **Verified:** 2026-07-15
- **Source:** bluebeacon.com; truckworldinc.com
- **Left blank (not verifiable from sources):** phone, lat, lng

### Blue Beacon Truck Wash of Stony Ridge — Perrysburg, OH

- **Segment:** A(west)
- **I-80 exit:** 71
- **Verified:** 2026-07-15
- **Source:** bluebeacon.com; truckstopsandservices.com
- **Left blank (not verifiable from sources):** lat, lng

## Weigh Stations

### I-80 Weigh Station (Hubbard, Westbound) — Hubbard, OH

- **Segment:** B(east)
- **I-80 exit:** MM 232 WB
- **Verified:** 2026-07-15
- **Source:** coopsareopen.com; Allstays; TruckMap
- **Left blank (not verifiable from sources):** address, phone, lat, lng

## Hotels with Truck Parking

### Travelodge by Wyndham at Truck World — Hubbard, OH

- **Segment:** B(east)
- **I-80 exit:** 234
- **Verified:** 2026-07-15
- **Source:** truckworldinc.com/travelodge
- **Left blank (not verifiable from sources):** phone, lat, lng

