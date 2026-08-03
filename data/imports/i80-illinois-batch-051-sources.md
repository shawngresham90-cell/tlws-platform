# Batch 51 — I-80 Illinois (Quad Cities/Iowa line → LaSalle-Peru → Ottawa → Morris/Minooka → Joliet → Chicago south suburbs → Indiana line): Source Report

Every listing was web-verified during research on **2026-07-15**. No field was invented: anything a source did not state is left blank in the CSV. Coordinates are blank on every row (geocoding is a separate verified workflow). Research method: web search against official brand/operator locators (Love's, Pilot/Flying J, TA/Petro, Sinclair, CAT Scale, state DOT/port-of-entry) as primary sources, with directory/review sites (iExit, Allstays, TruckMap, Find Truck Service, truckstopsandservices.com, coopsareopen.com, state rest-area guides) as secondary confirmation.

- Illinois already has 12 production rows (all on I-24 near Metropolis/Vienna); this batch was compiled against all 12 live importDupKey keys with 0 collisions.
- Cross-segment reconciliation at **Ottawa Exit 90**: both researchers returned the Lotz truck-and-trailer wash. It is included once (East, paired with the Lotz Truck Shop); the West duplicate was dropped.
- Freight clusters at Morris/Minooka (Exits 112-122) and Joliet (Exit 132). The Chicago Southland Lincoln Oasis (South Holland) sits over the I-80/94/294 concurrency and serves I-80 traffic; noted in-description with a blank numbered exit.
- Excluded stops on I-55/I-355/I-294/I-57/I-74/I-88/I-280 that are not on I-80; no Blue Beacon exists on the I-80 IL segments.

- Records in CSV: **34**
- Illinois existing production listings loaded for dedup: **12** (all on other corridors); collisions dropped: **0**

## Truck Stops & Travel Centers

### Atkinson Plaza (Shell) — Atkinson, IL

- **Segment:** A(west)
- **I-80 exit:** 27
- **Verified:** 2026-07-15
- **Source:** TruckMap; iExit
- **Left blank (not verifiable from sources):** address, website, lat, lng

### Love's Travel Stop #766 — Atkinson, IL

- **Segment:** A(west)
- **I-80 exit:** 27
- **Verified:** 2026-07-15
- **Source:** Love's locator; truckstopsandservices.com
- **Left blank (not verifiable from sources):** lat, lng

### Beck's Oil (Geneseo) — Geneseo, IL

- **Segment:** A(west)
- **I-80 exit:** 19
- **Verified:** 2026-07-15
- **Source:** truckstopsandservices.com; CAT Scale locator
- **Left blank (not verifiable from sources):** website, lat, lng

### Pilot Travel Center #1024 — Joliet, IL

- **Segment:** B(east)
- **I-80 exit:** 132B
- **Verified:** 2026-07-15
- **Source:** Pilot Flying J official locator (store #1024); truckstopsandservices.com; truckmap.com
- **Left blank (not verifiable from sources):** phone, lat, lng

### Flying J Travel Center #644 — La Salle, IL

- **Segment:** A(west)
- **I-80 exit:** 77
- **Verified:** 2026-07-15
- **Source:** Pilot Flying J locator; truckstopsandservices.com
- **Left blank (not verifiable from sources):** lat, lng

### Pilot Travel Center #236 — Minooka, IL

- **Segment:** B(east)
- **I-80 exit:** 122
- **Verified:** 2026-07-15
- **Source:** Pilot Flying J official locator (store #236); truckstopsandservices.com
- **Left blank (not verifiable from sources):** lat, lng

### Love's Travel Stop #859 — Morris, IL

- **Segment:** B(east)
- **I-80 exit:** 116
- **Verified:** 2026-07-15
- **Source:** Love's official locator (loves.com/locations/859); truckstopsandservices.com; findtruckservice.com
- **Left blank (not verifiable from sources):** lat, lng

### Pilot Travel Center #483 — Morris, IL

- **Segment:** B(east)
- **I-80 exit:** 112
- **Verified:** 2026-07-15
- **Source:** Pilot Flying J official locator (store #483); truckstopsandservices.com; CAT Scale locator
- **Left blank (not verifiable from sources):** lat, lng

### TA Morris — Morris, IL

- **Segment:** B(east)
- **I-80 exit:** 112B
- **Verified:** 2026-07-15
- **Source:** TA-Petro official locator (ta-petro.com/location/il/ta-morris); truckstopsandservices.com; CAT Scale locator
- **Left blank (not verifiable from sources):** lat, lng

### Sapp Bros Travel Center - Peru — Peru, IL

- **Segment:** A(west)
- **I-80 exit:** 73
- **Verified:** 2026-07-15
- **Source:** Sapp Bros. locator; truckstopsandservices.com
- **Left blank (not verifiable from sources):** lat, lng

### Road Ranger Travel Center #541 — Princeton, IL

- **Segment:** A(west)
- **I-80 exit:** 56
- **Verified:** 2026-07-15
- **Source:** Road Ranger locator; truckstopsandservices.com
- **Left blank (not verifiable from sources):** lat, lng

### Chicago Southland Lincoln Oasis — South Holland, IL

- **Segment:** B(east)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** Illinois Tollway (tollwayoases.com); allstays.com; truckstopsandservices.com
- **Left blank (not verifiable from sources):** exit_number, lat, lng

### Love's Travel Stop #351 — Utica, IL

- **Segment:** A(west)
- **I-80 exit:** 81
- **Verified:** 2026-07-15
- **Source:** Love's locator; truckstopsandservices.com
- **Left blank (not verifiable from sources):** lat, lng

## CAT Scales

### CAT Scale (Atkinson / Love's #766) — Atkinson, IL

- **Segment:** A(west)
- **I-80 exit:** 27
- **Verified:** 2026-07-15
- **Source:** CAT Scale locator; Love's locator
- **Left blank (not verifiable from sources):** lat, lng

### CAT Scale (Geneseo / Beck's Oil) — Geneseo, IL

- **Segment:** A(west)
- **I-80 exit:** 19
- **Verified:** 2026-07-15
- **Source:** CAT Scale locator
- **Left blank (not verifiable from sources):** lat, lng

### Joliet CAT Scale (Route 53 / Exit 132) — Joliet, IL

- **Segment:** B(east)
- **I-80 exit:** 132
- **Verified:** 2026-07-15
- **Source:** CAT Scale locator (catscale.com); allstays.com CAT list
- **Left blank (not verifiable from sources):** lat, lng

### CAT Scale (La Salle / Flying J #644) — La Salle, IL

- **Segment:** A(west)
- **I-80 exit:** 77
- **Verified:** 2026-07-15
- **Source:** CAT Scale locator
- **Left blank (not verifiable from sources):** lat, lng

### Pilot Travel Center #236 CAT Scale — Minooka, IL

- **Segment:** B(east)
- **I-80 exit:** 122
- **Verified:** 2026-07-15
- **Source:** CAT Scale locator (catscale.com); truckstopsandservices.com CAT list
- **Left blank (not verifiable from sources):** lat, lng

### Love's Travel Stop #859 CAT Scale — Morris, IL

- **Segment:** B(east)
- **I-80 exit:** 116
- **Verified:** 2026-07-15
- **Source:** CAT Scale locator (catscale.com); truckstopsandservices.com CAT list
- **Left blank (not verifiable from sources):** lat, lng

### Pilot Travel Center #483 CAT Scale — Morris, IL

- **Segment:** B(east)
- **I-80 exit:** 112
- **Verified:** 2026-07-15
- **Source:** CAT Scale locator (catscale.com); truckstopsandservices.com CAT list
- **Left blank (not verifiable from sources):** lat, lng

### TA Morris CAT Scale — Morris, IL

- **Segment:** B(east)
- **I-80 exit:** 112B
- **Verified:** 2026-07-15
- **Source:** CAT Scale locator (catscale.com); truckstopsandservices.com CAT list
- **Left blank (not verifiable from sources):** lat, lng

### CAT Scale (Princeton / Road Ranger) — Princeton, IL

- **Segment:** A(west)
- **I-80 exit:** 56
- **Verified:** 2026-07-15
- **Source:** CAT Scale locator
- **Left blank (not verifiable from sources):** lat, lng

### CAT Scale (Utica / Love's #351) — Utica, IL

- **Segment:** A(west)
- **I-80 exit:** 81
- **Verified:** 2026-07-15
- **Source:** CAT Scale locator
- **Left blank (not verifiable from sources):** lat, lng

## Tire & Repair

### Princeton Tire Service — Princeton, IL

- **Segment:** A(west)
- **I-80 exit:** 56
- **Verified:** 2026-07-15
- **Source:** iExit; Yellow Pages
- **Left blank (not verifiable from sources):** website, lat, lng

## Roadside Service

### Lotz Truck Shop — Ottawa, IL

- **Segment:** B(east)
- **I-80 exit:** 90
- **Verified:** 2026-07-15
- **Source:** lotztrucking.com; mtstruckservice.com; findtruckservice.com
- **Left blank (not verifiable from sources):** lat, lng

## Truck Parking

### Three Rivers Rest Area (Westbound) — Minooka, IL

- **Segment:** B(east)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** illinoisrestareas.com; Illinois DOT
- **Left blank (not verifiable from sources):** address, phone, exit_number, lat, lng

### Three Rivers Rest Area (Eastbound) — Morris, IL

- **Segment:** B(east)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** illinoisrestareas.com; Illinois DOT; truckerpath.com
- **Left blank (not verifiable from sources):** address, phone, exit_number, lat, lng

### Mississippi Rapids Rest Area (Welcome Center) — Rapids City, IL

- **Segment:** A(west)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** illinoisrestareas.com; truckstopsandservices.com
- **Left blank (not verifiable from sources):** address, zip, phone, exit_number, lat, lng

### Great Sauk Trail Rest Area — Wyanet, IL

- **Segment:** A(west)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** illinoisrestareas.com; iExit
- **Left blank (not verifiable from sources):** address, phone, exit_number, lat, lng

## Truck Washes

### Exit 90 on I-80 Truck & Trailer Wash (Lotz) — Ottawa, IL

- **Segment:** B(east)
- **I-80 exit:** 90
- **Verified:** 2026-07-15
- **Source:** i80truckwash.com; 4roadservice.com; findtruckservice.com
- **Left blank (not verifiable from sources):** lat, lng

### Diamond Truck Wash — Peru, IL

- **Segment:** A(west)
- **I-80 exit:** 73
- **Verified:** 2026-07-15
- **Source:** truckwashstations.com; allstays.com
- **Left blank (not verifiable from sources):** website, lat, lng

## Weigh Stations

### I-80 Weigh Station (Quad Cities) — East Moline, IL

- **Segment:** A(west)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** coopsareopen.com; Illinois DOT weigh-station map
- **Left blank (not verifiable from sources):** address, zip, phone, exit_number, lat, lng

### Frankfort Weigh Station (Eastbound) — Frankfort, IL

- **Segment:** B(east)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** coopsareopen.com; Illinois DOT weigh-station map; jackreports.com
- **Left blank (not verifiable from sources):** address, zip, exit_number, lat, lng

### Frankfort Weigh Station (Westbound) — Frankfort, IL

- **Segment:** B(east)
- **I-80 exit:** (blank — not verified)
- **Verified:** 2026-07-15
- **Source:** coopsareopen.com; Illinois DOT weigh-station map; jackreports.com
- **Left blank (not verifiable from sources):** address, zip, phone, exit_number, lat, lng

