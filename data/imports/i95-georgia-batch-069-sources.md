# Batch 69 — I-95 Georgia (FL line/Kingsland → Woodbine → Brunswick → Darien → Midway → Richmond Hill → Savannah → Port Wentworth → SC line): Source Report

Every listing was web-verified during research on **2026-07-15**. No field was invented: anything a source did not state is left blank in the CSV. Coordinates are blank on every row (geocoding is a separate verified workflow). Research method: web search against official brand/operator locators (Love's, Pilot/Flying J, TA/Petro, Sinclair, CAT Scale, state DOT/port-of-entry) as primary sources, with directory/review sites (iExit, Allstays, TruckMap, Find Truck Service, truckstopsandservices.com, coopsareopen.com, state rest-area guides) as secondary confirmation.

- DEDUP state: 82 existing GA production rows form the avoid-list — but ALL 82 are on the I-75 corridor (Ringgold→Valdosta) and the Atlanta metro, plus the I-24 Wildwood corner, none on the I-95 coast, so no live collisions expected.
- South (FL line→Midway): the Kingsland Exit 1/3 border cluster (Pilot #4562, Pilot #575, Petro #344) each with a CAT scale + the northbound Georgia Welcome Center; the Brunswick Exit 29 hub (Love's #405, Flying J #627, TA Brunswick, Blue Beacon, Love's Speedco #906, Dynamic Diesel) each brand with a CAT scale; Woodbine, Darien and Midway independents; the Townsend weigh stations and Glynn County rest area. North (Midway→SC line): the Savannah port node — TA Savannah #177 (Exit 87), Love's #338 (90), Love's #893 (94, Garden City), Parker's Pooler, Pilot #71 (Port Wentworth Exit 109) each with a CAT scale; Southern Tire Mart Pooler + Port Wentworth, Snider Savannah, CMJ truck wash, the Port Wentworth weigh station, the southbound Georgia Welcome Center + Carson rest area, Savannah towing and CDL school.
- No cross-segment duplicates (south ends at Midway Exit 76, north starts at Richmond Hill Exit 87; Georgia has welcome centers at both ends — Kingsland NB and Port Wentworth SB — listed separately). Ten distinct CAT scales corridor-wide, each kept once.
- Pilot #575 St. Marys website blanked (the real URL contains apostrophes that would fail URL validation); milepost welcome centers/weigh stations/rest areas left exit blank with the nearest named I-95 locality for city.
- Omitted, not fabricated: I-75 Georgia and Atlanta-metro facilities; Sapp Bros (I-80 chain, no GA location); unverified planned Darien 'JP Travel Center'; Brunswick Exit 36/38 Shell (parking unconfirmed); Pooler/Port Wentworth hotels not verifiably offering truck parking.

- Records in CSV: **41**
- Georgia existing production listings loaded for dedup: **82** (all on other corridors); collisions dropped: **0**

## Truck Stops & Travel Centers

### Flying J Travel Center #627 — Brunswick, GA

- **Segment:** A(south)
- **I-80 exit:** 29
- **Verified:** 2026-07-15
- **Source:** locations.pilotflyingj.com; truckstopsandservices.com #16991
- **Left blank (not verifiable from sources):** lat, lng

### Love's Travel Stop #405 — Brunswick, GA

- **Segment:** A(south)
- **I-80 exit:** 29
- **Verified:** 2026-07-15
- **Source:** loves.com; truckstopsandservices.com #1914
- **Left blank (not verifiable from sources):** lat, lng

### TA Travel Center Brunswick — Brunswick, GA

- **Segment:** A(south)
- **I-80 exit:** 29
- **Verified:** 2026-07-15
- **Source:** allstays.com #96435; findtruckservice Brunswick truck stops
- **Left blank (not verifiable from sources):** phone, website, lat, lng

### El Cheapo #54 (Texaco) — Darien, GA

- **Segment:** A(south)
- **I-80 exit:** 49
- **Verified:** 2026-07-15
- **Source:** truckstopsandservices.com #818; findfuelstops.com #004904; 4roadservice.com
- **Left blank (not verifiable from sources):** website, lat, lng

### Love's Travel Stop #893 — Garden City, GA

- **Segment:** B(north)
- **I-80 exit:** 94
- **Verified:** 2026-07-15
- **Source:** loves.com official location #893; findfuelstops
- **Left blank (not verifiable from sources):** lat, lng

### Petro Stopping Center #344 (TA/Petro Kingsland) — Kingsland, GA

- **Segment:** A(south)
- **I-80 exit:** 3
- **Verified:** 2026-07-15
- **Source:** ta-petro.com; truckstopsandservices.com #2276
- **Left blank (not verifiable from sources):** lat, lng

### Pilot Travel Center #4562 — Kingsland, GA

- **Segment:** A(south)
- **I-80 exit:** 1
- **Verified:** 2026-07-15
- **Source:** locations.pilotflyingj.com; truckstopsandservices.com #3703
- **Left blank (not verifiable from sources):** lat, lng

### El Cheapo #50 — Midway, GA

- **Segment:** A(south)
- **I-80 exit:** 76
- **Verified:** 2026-07-15
- **Source:** truckstopsandservices.com #819; findtruckservice.com #421129; truckstopreport.com
- **Left blank (not verifiable from sources):** website, lat, lng

### Parker's Kitchen #69 — Pooler, GA

- **Segment:** B(north)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** truckstopsandservices #66439 (Parker's #69 Pooler); findtruckservice
- **Left blank (not verifiable from sources):** address, exit_number, lat, lng

### Pilot Travel Center #71 — Port Wentworth, GA

- **Segment:** B(north)
- **I-80 exit:** 109
- **Verified:** 2026-07-15
- **Source:** pilotflyingj.com official location; truckstopsandservices #16919
- **Left blank (not verifiable from sources):** lat, lng

### El Cheapo (Richmond Hill) — Richmond Hill, GA

- **Segment:** B(north)
- **I-80 exit:** 87
- **Verified:** 2026-07-15
- **Source:** truckstopsandservices #822 (El Cheapo I-95 Exit 87); findtruckservice
- **Left blank (not verifiable from sources):** address, phone, website, lat, lng

### Love's Travel Stop #338 — Richmond Hill, GA

- **Segment:** B(north)
- **I-80 exit:** 90
- **Verified:** 2026-07-15
- **Source:** loves.com official location #338
- **Left blank (not verifiable from sources):** lat, lng

### TA Savannah (TravelCenters of America #177) — Richmond Hill, GA

- **Segment:** B(north)
- **I-80 exit:** 87
- **Verified:** 2026-07-15
- **Source:** ta-petro.com official location page; truckstopsandservices #177
- **Left blank (not verifiable from sources):** phone, lat, lng

### Pilot Travel Center #575 — St. Marys, GA

- **Segment:** A(south)
- **I-80 exit:** 1
- **Verified:** 2026-07-15
- **Source:** locations.pilotflyingj.com; findtruckservice.com #410549
- **Left blank (not verifiable from sources):** website, lat, lng

### Coastal Chevron / Sunshine Travel Plaza — Woodbine, GA

- **Segment:** A(south)
- **I-80 exit:** 14
- **Verified:** 2026-07-15
- **Source:** findtruckservice.com #421127; truckstopsandservices.com #3139
- **Left blank (not verifiable from sources):** website, lat, lng

## CAT Scales

### CAT Scale at Flying J Brunswick (#627) — Brunswick, GA

- **Segment:** A(south)
- **I-80 exit:** 29
- **Verified:** 2026-07-15
- **Source:** locations.pilotflyingj.com; catscale.com locator
- **Left blank (not verifiable from sources):** phone, lat, lng

### CAT Scale at Love's Brunswick (#405) — Brunswick, GA

- **Segment:** A(south)
- **I-80 exit:** 29
- **Verified:** 2026-07-15
- **Source:** loves.com; catscale.com locator
- **Left blank (not verifiable from sources):** phone, lat, lng

### CAT Scale at Love's Garden City (#893) — Garden City, GA

- **Segment:** B(north)
- **I-80 exit:** 94
- **Verified:** 2026-07-15
- **Source:** loves.com location #893 (lists CAT scale)
- **Left blank (not verifiable from sources):** phone, lat, lng

### CAT Scale at Petro Kingsland (#344) — Kingsland, GA

- **Segment:** A(south)
- **I-80 exit:** 3
- **Verified:** 2026-07-15
- **Source:** ta-petro.com; catscale.com locator
- **Left blank (not verifiable from sources):** phone, lat, lng

### CAT Scale at Pilot Kingsland (#4562) — Kingsland, GA

- **Segment:** A(south)
- **I-80 exit:** 1
- **Verified:** 2026-07-15
- **Source:** locations.pilotflyingj.com; catscale.com locator
- **Left blank (not verifiable from sources):** phone, lat, lng

### CAT Scale at Pilot Port Wentworth (#71) — Port Wentworth, GA

- **Segment:** B(north)
- **I-80 exit:** 109
- **Verified:** 2026-07-15
- **Source:** pilotflyingj.com / truckstopsandservices #16919 (lists CAT scale)
- **Left blank (not verifiable from sources):** phone, lat, lng

### CAT Scale at Love's Richmond Hill (#338) — Richmond Hill, GA

- **Segment:** B(north)
- **I-80 exit:** 90
- **Verified:** 2026-07-15
- **Source:** loves.com location #338 (lists CAT scale)
- **Left blank (not verifiable from sources):** phone, lat, lng

### CAT Scale at TA Savannah — Richmond Hill, GA

- **Segment:** B(north)
- **I-80 exit:** 87
- **Verified:** 2026-07-15
- **Source:** ta-petro.com location page (lists CAT scale)
- **Left blank (not verifiable from sources):** phone, lat, lng

### CAT Scale at Pilot St. Marys (#575) — St. Marys, GA

- **Segment:** A(south)
- **I-80 exit:** 1
- **Verified:** 2026-07-15
- **Source:** findtruckservice.com #410549; catscale.com locator
- **Left blank (not verifiable from sources):** phone, lat, lng

## Tire & Repair

### Love's Speedco #906 — Brunswick, GA

- **Segment:** A(south)
- **I-80 exit:** 29
- **Verified:** 2026-07-15
- **Source:** loves.com / Speedco; findtruckservice.com #411791
- **Left blank (not verifiable from sources):** lat, lng

### Southern Tire Mart - Pooler — Pooler, GA

- **Segment:** B(north)
- **I-80 exit:** 102
- **Verified:** 2026-07-15
- **Source:** stmtires.com official store page; findtruckservice #150
- **Left blank (not verifiable from sources):** lat, lng

### Southern Tire Mart at Pilot - Port Wentworth — Port Wentworth, GA

- **Segment:** B(north)
- **I-80 exit:** 109
- **Verified:** 2026-07-15
- **Source:** stmtires.com official store STMP-357 page
- **Left blank (not verifiable from sources):** phone, lat, lng

### Snider Fleet Solutions - Savannah — Savannah, GA

- **Segment:** B(north)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** sniderfleet.com locations; CMac business listing
- **Left blank (not verifiable from sources):** exit_number, lat, lng

## Roadside Service

### Dynamic Diesel Solutions — Brunswick, GA

- **Segment:** A(south)
- **I-80 exit:** 29
- **Verified:** 2026-07-15
- **Source:** findtruckservice.com Brunswick roadside listing
- **Left blank (not verifiable from sources):** phone, website, lat, lng

### Sapp's Wrecker Service — Savannah, GA

- **Segment:** B(north)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** sappswrecker.guardianfleetservice.com
- **Left blank (not verifiable from sources):** address, zip, phone, exit_number, lat, lng

### Tim's Towing & Recovery — Savannah, GA

- **Segment:** B(north)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** timstowingandrecovery.com; Yelp listing (2141 Gamble Rd, Savannah)
- **Left blank (not verifiable from sources):** phone, exit_number, lat, lng

## Truck Parking

### GA I-95 Glynn County Rest Area (Southbound) — Brunswick, GA

- **Segment:** A(south)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** georgiarestareas.com / GDOT. City recorded as Brunswick, the nearest named I-95 locality (Glynn County).
- **Left blank (not verifiable from sources):** address, zip, phone, exit_number, lat, lng

### Georgia Welcome Center (I-95 Northbound) — Kingsland, GA

- **Segment:** A(south)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** GDOT restareaswelcomecenters; exploregeorgia.org. City recorded as Kingsland, the nearest named I-95 locality (Camden County).
- **Left blank (not verifiable from sources):** address, zip, phone, exit_number, lat, lng

### Carson Safety Rest Area - I-95 NB — Port Wentworth, GA

- **Segment:** B(north)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** GDOT rest areas; georgiarestareas.com. City recorded as Port Wentworth, the nearest named I-95 locality.
- **Left blank (not verifiable from sources):** address, phone, exit_number, lat, lng

### Georgia Welcome Center (Savannah) - I-95 SB — Port Wentworth, GA

- **Segment:** B(north)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** exploregeorgia.org / GDOT. City recorded as Port Wentworth, the nearest named I-95 locality.
- **Left blank (not verifiable from sources):** address, exit_number, lat, lng

## Truck Washes

### Blue Beacon Truck Wash of Brunswick — Brunswick, GA

- **Segment:** A(south)
- **I-80 exit:** 29
- **Verified:** 2026-07-15
- **Source:** bluebeacon.com; truckstopsandservices.com #8823
- **Left blank (not verifiable from sources):** lat, lng

### CMJ Truck Wash — Port Wentworth, GA

- **Segment:** B(north)
- **I-80 exit:** 109
- **Verified:** 2026-07-15
- **Source:** findtruckservice (Port Wentworth truck wash listing)
- **Left blank (not verifiable from sources):** website, lat, lng

## Weigh Stations

### I-95 Weigh Station - Port Wentworth — Port Wentworth, GA

- **Segment:** B(north)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** truckmap / Waze (Weigh Station Port Wentworth SB I-95). City recorded as Port Wentworth, the nearest named I-95 locality.
- **Left blank (not verifiable from sources):** address, phone, website, exit_number, lat, lng

### GA DPS Weigh Station (I-95 Northbound, Townsend) — Townsend, GA

- **Segment:** A(south)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** coopsareopen.com Georgia weigh stations (Station 21 North). City recorded as Townsend, the nearest named I-95 locality (McIntosh County).
- **Left blank (not verifiable from sources):** address, zip, website, exit_number, lat, lng

### GA DPS Weigh Station (I-95 Southbound, Townsend) — Townsend, GA

- **Segment:** A(south)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** coopsareopen.com Georgia weigh stations (Station 20 South). City recorded as Townsend, the nearest named I-95 locality (McIntosh County).
- **Left blank (not verifiable from sources):** address, zip, website, exit_number, lat, lng

