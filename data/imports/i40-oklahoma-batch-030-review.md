# Batch 30 — I-40 Oklahoma: Review Summary

CSV: `data/imports/i40-oklahoma-batch-030.csv` · verified 2026-07-14 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). **Nothing has been imported to
production.**

This batch fills the I-40 gap across Oklahoma — the freight-heavy Arkansas line
at Roland/Fort Smith, through the Checotah (I-40/US-69) and Henryetta (US-75)
junction clusters, the Oklahoma City / Morgan Road travel-center cluster, and
west through Clinton, Sayre, Elk City and Erick to the Texas line at Texola. It
connects the existing I-40 Arkansas coverage (production) to a future I-40 Texas
panhandle batch. Oklahoma had **0** existing production rows, so this is first
coverage of the state on this corridor.

## Totals

- Total rows in CSV: **26**
- Expansion verdict — ready-to-publish: **15**
- Expansion verdict — import-unpublished (held, documented): **11**
- manual-review / reject: **0 / 0**
- Featured = yes: **0** (featuring requires explicit approval)
- TruckParkingClub URLs: **0** (none listed on truckparkingclub.com for these rows); no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by state

| State | Rows | Ready | Held |
| --- | --- | --- | --- |
| OK | 26 | 15 | 11 |

## Rows by category

| Category | Rows | Ready | Held |
| --- | --- | --- | --- |
| Truck Stops & Travel Centers | 20 | 11 | 9 |
| CAT Scales | 2 | 2 | 0 |
| Tire Repair | 1 | 1 | 0 |
| Weigh Stations | 3 | 1 | 2 |
| **Total** | **26** | **15** | **11** |

Held rows are import-unpublished because a source did not confirm a street
address, ZIP, phone, or exit number and blank was kept over a guess (weigh
stations especially, which rarely publish an address/exit). They import cleanly
and can be published once a field is verified.

## Corridor coverage (AR line → Checotah/Henryetta → OKC metro → Sayre/Elk City → TX line)

- Distinct I-40 exits represented: **16** — 7, 20, 26, 41, 71, 84, 127, 140, 178, 221, 237, 264, 265, 287, 308, 325

## Rows by city (east → west)

| City | Rows |
| --- | --- |
| Roland | 1 |
| Sallisaw | 1 |
| Webbers Falls | 2 |
| Checotah | 2 |
| Henryetta | 1 |
| Okemah | 1 |
| Shawnee | 1 |
| El Reno | 2 |
| Oklahoma City | 6 |
| Weatherford | 2 |
| Clinton | 1 |
| Sayre | 3 |
| Elk City | 1 |
| Erick | 2 |

## Segments

- **A — East (9):** AR line at Roland (Exit 325) → Shawnee (Exit 178): Pilot (Roland), Sallisaw Travel Center, Love's #255 Webbers Falls (Truck Care + CAT Scale), the Checotah I-40/US-69 cluster (Flying J #702, Kwik-N-EZ), R & R Truck Stop Henryetta, Love's #274 Okemah, FireLake Grand Travel Plaza (Citizen Potawatomi Nation) Shawnee, plus a Webbers Falls weigh station.
- **B — OKC metro (8):** El Reno (Exit 127) + the Morgan Road (Exit 140) travel-center cluster: Love's #737 El Reno, TA OKC West #059, Love's (Morgan Rd), Flying J #703, Petro OKC #316 (MLK Ave), the CAT Scale at TA OKC West, Goodyear Commercial Tire #255, and the El Reno weigh station.
- **C — West (9):** Weatherford → Erick/Texola: Love's #248 Clinton (Exit 71), Love's #201 Elk City, Love's #253 Erick (Exit 7, last stop before TX), TA Sayre (Exit 26), Flying J #705 Sayre (Exit 20) + its CAT Scale, two Weatherford independents (Fast Lane, Asap's), and the Erick port of entry / weigh station.

## Accuracy & exclusions

- Every row was web-verified on 2026-07-14 against official brand locators (Love's, Pilot/Flying J, TA/Petro, CAT Scale) with directory/review sites as secondary confirmation. Per-row sources in `-sources.md`.
- No field was invented: unverifiable address/ZIP/phone/exit values are blank.
- Towns with no confidently-verified I-40 facility were omitted rather than fabricated: Vian, Gore, Warner, Council Hill, Boley, Prague, McLoud, Dale (east); Calumet, Geary, Foss, Canute, Texola (west). The Love's often associated with "Checotah" is on US-69, not I-40, and the Dale-area Love's #486 (Exit 166) is addressed in Choctaw — both excluded from this I-40 batch to avoid mis-siting.
