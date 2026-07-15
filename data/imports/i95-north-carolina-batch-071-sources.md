# Batch 71 — I-95 North Carolina (SC line/Rowland → Lumberton → Fayetteville → Dunn → Benson/Smithfield (I-40 jct) → Kenly → Wilson → Rocky Mount → Enfield → Roanoke Rapids → VA line/Pleasant Hill Exit 180): Source Report

Every listing was web-verified during research on **2026-07-15**. No field was invented: anything a source did not state is left blank in the CSV. Coordinates are blank on every row (geocoding is a separate verified workflow). Research method: web search against official brand/operator locators (Love's, Pilot/Flying J, TA/Petro, Sinclair, CAT Scale, state DOT/port-of-entry) as primary sources, with directory/review sites (iExit, Allstays, TruckMap, Find Truck Service, truckstopsandservices.com, coopsareopen.com, state rest-area guides) as secondary confirmation.

- Live NC production = 45 rows, ALL on the I-40 corridor in western/mountain NC (Asheville, Hickory, Marion, Morganton, Old Fort, Canton, Waynesville, Black Mountain, Lake Junaluska). I-95 is eastern NC — zero corridor overlap. Avoid-list (45 name|city|state keys + 45 slugs) loaded for dedup; expected live collisions: 0.
- South (SC line/Rowland Exit 1 → Lumberton → Fayetteville → Dunn Exit 75): the freight anchors are the Lumberton exits (Exits 20/22 truck-stop cluster) and the Fayetteville metro (Exits 44/49/56); Dunn (Exits 72/73/75). North (Benson Exit 79 → Smithfield/I-40 jct → Kenly Exit 106/107 → Wilson → Rocky Mount → Roanoke Rapids → VA line Exit 180): Kenly is the major mid-corridor truck-stop node, plus Rocky Mount and Roanoke Rapids.
- Cross-segment reconciliation applied where a facility straddles the Dunn/Benson boundary; each facility kept once in its richer segment.
- NCDOT rest areas / welcome centers are milepost facilities (exit blank, nearest named locality for city). The NC Welcome Center near the VA line at Pleasant Hill (Exit 180, Roanoke Rapids) included. No coordinates supplied (geocoding is a separate verified workflow).

- Records in CSV: **44**
- North Carolina existing production listings loaded for dedup: **45** (all on other corridors); collisions dropped: **0**

## Truck Stops & Travel Centers

### Love's Travel Stop #412 — Dunn, NC

- **Segment:** A(south)
- **I-80 exit:** 77
- **Verified:** 2026-07-15
- **Source:** loves.com official locator; truckstopsandservices.com
- **Left blank (not verifiable from sources):** lat, lng

### Pilot Travel Center (Sadler Travel Plaza) — Dunn, NC

- **Segment:** A(south)
- **I-80 exit:** 75
- **Verified:** 2026-07-15
- **Source:** pilotflyingj.com official locator; truckstopsandservices.com
- **Left blank (not verifiable from sources):** lat, lng

### Sunoco Travel Plaza (Cedar Creek Rd) — Fayetteville, NC

- **Segment:** A(south)
- **I-80 exit:** 49
- **Verified:** 2026-07-15
- **Source:** iExit Interstate Exit Guide; sunoco.com locator; findtruckservice.com
- **Left blank (not verifiable from sources):** website, lat, lng

### Oasis Travel Center (Lakewood Landing) — Halifax, NC

- **Segment:** B(north)
- **I-80 exit:** 168
- **Verified:** 2026-07-15
- **Source:** truckerpath.com, findtruckservice.com, allstays.com
- **Left blank (not verifiable from sources):** website, lat, lng

### Sheetz #804 — Hope Mills, NC

- **Segment:** A(south)
- **I-80 exit:** 41
- **Verified:** 2026-07-15
- **Source:** thetrucker.com / movinout.com grand-opening coverage; truckstopsandservices.com
- **Left blank (not verifiable from sources):** phone, lat, lng

### Flying J Travel Center #683 — Kenly, NC

- **Segment:** B(north)
- **I-80 exit:** 106
- **Verified:** 2026-07-15
- **Source:** locations.pilotflyingj.com, rvparky.com, truckstopsandservices.com
- **Left blank (not verifiable from sources):** phone, lat, lng

### Petro Kenly 95 #395 — Kenly, NC

- **Segment:** B(north)
- **I-80 exit:** 106
- **Verified:** 2026-07-15
- **Source:** kenly95.com, ta-petro.com, truckstopsandservices.com
- **Left blank (not verifiable from sources):** phone, lat, lng

### Pilot Travel Center #6990 — Kenly, NC

- **Segment:** B(north)
- **I-80 exit:** 106
- **Verified:** 2026-07-15
- **Source:** locations.pilotflyingj.com, findtruckservice.com
- **Left blank (not verifiable from sources):** lat, lng

### Sun Do Truck Stop — Lumberton, NC

- **Segment:** A(south)
- **I-80 exit:** 22
- **Verified:** 2026-07-15
- **Source:** findtruckservice.com; iExit Interstate Exit Guide
- **Left blank (not verifiable from sources):** phone, website, lat, lng

### Pilot Travel Center #58 (ONE9) — Pleasant Hill, NC

- **Segment:** B(north)
- **I-80 exit:** 180
- **Verified:** 2026-07-15
- **Source:** findfuelstops.com, locations.pilotflyingj.com
- **Left blank (not verifiable from sources):** lat, lng

## CAT Scales

### CAT Scale at Love's Dunn — Dunn, NC

- **Segment:** A(south)
- **I-80 exit:** 77
- **Verified:** 2026-07-15
- **Source:** catscale.com locator; loves.com
- **Left blank (not verifiable from sources):** lat, lng

### CAT Scale at Pilot Dunn (Sadler Travel Plaza) — Dunn, NC

- **Segment:** A(south)
- **I-80 exit:** 75
- **Verified:** 2026-07-15
- **Source:** catscale.com locator; truckstopsandservices.com
- **Left blank (not verifiable from sources):** lat, lng

### CAT Scale at Flying J Kenly — Kenly, NC

- **Segment:** B(north)
- **I-80 exit:** 106
- **Verified:** 2026-07-15
- **Source:** catscale.com, locations.pilotflyingj.com
- **Left blank (not verifiable from sources):** phone, lat, lng

### CAT Scale at Kenly 95 — Kenly, NC

- **Segment:** B(north)
- **I-80 exit:** 106
- **Verified:** 2026-07-15
- **Source:** kenly95.com, catscale.com
- **Left blank (not verifiable from sources):** lat, lng

### CAT Scale at Pilot Pleasant Hill — Pleasant Hill, NC

- **Segment:** B(north)
- **I-80 exit:** 180
- **Verified:** 2026-07-15
- **Source:** catscale.com, findfuelstops.com
- **Left blank (not verifiable from sources):** lat, lng

## Tire & Repair

### Tire Sales & Service, Inc. (Commercial Tires) — Fayetteville, NC

- **Segment:** A(south)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** tiresalesandserviceinc.com commercial tires page
- **Left blank (not verifiable from sources):** address, phone, exit_number, lat, lng

### Kenly 95 Truck Service Center — Kenly, NC

- **Segment:** B(north)
- **I-80 exit:** 106
- **Verified:** 2026-07-15
- **Source:** kenly95.com
- **Left blank (not verifiable from sources):** phone, lat, lng

### Love's Speedco #930 — Kenly, NC

- **Segment:** B(north)
- **I-80 exit:** 106
- **Verified:** 2026-07-15
- **Source:** loves.com, findtruckservice.com
- **Left blank (not verifiable from sources):** lat, lng

### Discount Tire Sales & Service (Lumberton) — Lumberton, NC

- **Segment:** A(south)
- **I-80 exit:** 22
- **Verified:** 2026-07-15
- **Source:** discounttiresalesnc.com
- **Left blank (not verifiable from sources):** address, phone, lat, lng

### Colony Tire Corporation - Rocky Mount — Rocky Mount, NC

- **Segment:** B(north)
- **I-80 exit:** 145
- **Verified:** 2026-07-15
- **Source:** colonytire.com
- **Left blank (not verifiable from sources):** lat, lng

## Roadside Service

### Mangum's Towing & Road Service (Fayetteville) — Fayetteville, NC

- **Segment:** A(south)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** mangumsinc.com; FMCSA SAFER (Mangum's Inc)
- **Left blank (not verifiable from sources):** address, exit_number, lat, lng

### Central Carolina Diesel Repair — Kenly, NC

- **Segment:** B(north)
- **I-80 exit:** 106
- **Verified:** 2026-07-15
- **Source:** findtruckservice.com search results
- **Left blank (not verifiable from sources):** address, phone, website, lat, lng

### C-R Road Service — Lumberton, NC

- **Segment:** A(south)
- **I-80 exit:** 17
- **Verified:** 2026-07-15
- **Source:** findtruckservice.com; 4roadservice.com
- **Left blank (not verifiable from sources):** phone, website, lat, lng

### Coastal Towing (Coastal Wrecker) — Rocky Mount, NC

- **Segment:** B(north)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** coastalwrecker.com
- **Left blank (not verifiable from sources):** address, phone, exit_number, lat, lng

### Mangum's Towing & Road Service (Rocky Mount) — Rocky Mount, NC

- **Segment:** B(north)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** mangumsinc.com
- **Left blank (not verifiable from sources):** address, exit_number, lat, lng

## Truck Parking

### I-95 Nash County Rest Area (MM 142) — Battleboro, NC

- **Segment:** B(north)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** NCDOT rest area list, northcarolinarestareas.com
- **Left blank (not verifiable from sources):** address, phone, exit_number, lat, lng

### I-95 Cumberland County Rest Area (Northbound) — Fayetteville, NC

- **Segment:** A(south)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** NCDOT rest area list; northcarolinarestareas.com
- **Left blank (not verifiable from sources):** phone, exit_number, lat, lng

### I-95 Cumberland County Rest Area (Southbound) — Fayetteville, NC

- **Segment:** A(south)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** NCDOT rest area list; northcarolinarestareas.com
- **Left blank (not verifiable from sources):** phone, exit_number, lat, lng

### North Carolina Welcome Center - I-95 Northampton — Pleasant Hill, NC

- **Segment:** B(north)
- **I-80 exit:** 180
- **Verified:** 2026-07-15
- **Source:** NC Commerce welcome centers, northcarolinarestareas.com
- **Left blank (not verifiable from sources):** address, phone, lat, lng

### I-95 South N.C. Welcome Center — Rowland, NC

- **Segment:** A(south)
- **I-80 exit:** 1
- **Verified:** 2026-07-15
- **Source:** VisitNC.com; NCDOT; Robesonian news coverage
- **Left blank (not verifiable from sources):** phone, lat, lng

### I-95 Johnston County Rest Area (MM 99) — Selma, NC

- **Segment:** B(north)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** NCDOT rest area list, northcarolinarestareas.com
- **Left blank (not verifiable from sources):** address, phone, exit_number, lat, lng

## Truck Washes

### Blue Beacon Truck Wash of Kenly — Kenly, NC

- **Segment:** B(north)
- **I-80 exit:** 106
- **Verified:** 2026-07-15
- **Source:** bluebeacon.com, findtruckservice.com
- **Left blank (not verifiable from sources):** address, lat, lng

### C-R Road Service Truck & Trailer Wash — Lumberton, NC

- **Segment:** A(south)
- **I-80 exit:** 17
- **Verified:** 2026-07-15
- **Source:** findtruckservice.com truck-wash directory
- **Left blank (not verifiable from sources):** phone, website, lat, lng

## Weigh Stations

### Halifax County I-95 Weigh Station (SHP) — Enfield, NC

- **Segment:** B(north)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** ncdps.gov / ncshp.gov weigh stations page
- **Left blank (not verifiable from sources):** address, exit_number, lat, lng

### I-95 Robeson County Weigh Station (Northbound) — Lumberton, NC

- **Segment:** A(south)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** NC State Highway Patrol; coopsareopen.com; truckstopsandservices.com
- **Left blank (not verifiable from sources):** exit_number, lat, lng

### I-95 Robeson County Weigh Station (Southbound) — Lumberton, NC

- **Segment:** A(south)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** NC State Highway Patrol; coopsareopen.com; truckstopsandservices.com
- **Left blank (not verifiable from sources):** exit_number, lat, lng

## Hotels with Truck Parking

### Royal Inn Lumberton — Lumberton, NC

- **Segment:** A(south)
- **I-80 exit:** 20
- **Verified:** 2026-07-15
- **Source:** i95exitguide.com overnight-stops guide
- **Left blank (not verifiable from sources):** address, website, lat, lng

### Rocky Mount Inn — Rocky Mount, NC

- **Segment:** B(north)
- **I-80 exit:** 138
- **Verified:** 2026-07-15
- **Source:** rockymountinn.com, hoteltruckparking.com
- **Left blank (not verifiable from sources):** lat, lng

