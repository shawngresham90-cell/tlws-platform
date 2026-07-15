# Batch 36 — I-70 Kansas: Review Summary

CSV: `data/imports/i70-kansas-batch-036.csv` · verified 2026-07-14 · dry-run
validated against the live import parser (`prepareImport`) **and** the Expansion
Readiness assessment (`assessExpansion`). **Nothing has been imported to
production.**

This batch continues the I-70 corridor west from Missouri across **Kansas** — a
long, freight-heavy plains crossing. It runs the western towns (Oakley, Colby,
Goodland) to the Colorado line, the central **Salina** (I-70/I-135) and **Hays**
(US-183) hubs plus Russell, Ellis and WaKeeney, and the eastern end at Junction
City and Abilene, including the Love's-operated **Kansas Turnpike** service areas
at Topeka and Lawrence. Kansas had **0** existing I-70 production rows — first
coverage of the state and corridor.

## Totals

- Total rows in CSV: **24**
- Expansion verdict — ready-to-publish: **16**
- Expansion verdict — import-unpublished (held, documented): **8**
- manual-review / reject: **0 / 0**
- Featured = yes: **0** (featuring requires explicit approval)
- TruckParkingClub URLs: **0**; no affiliate codes.
- Coordinates: **none supplied** — geocoding is a separate verified workflow.

## Rows by state

| State | Rows | Ready | Held |
| --- | --- | --- | --- |
| KS | 24 | 16 | 8 |

## Rows by category

| Category | Rows | Ready | Held |
| --- | --- | --- | --- |
| Truck Stops & Travel Centers | 17 | 11 | 6 |
| CAT Scales | 3 | 3 | 0 |
| Roadside Service | 1 | 1 | 0 |
| Truck Washes | 1 | 1 | 0 |
| Weigh Stations | 2 | 0 | 2 |
| **Total** | **24** | **16** | **8** |

Held rows are import-unpublished because a source did not confirm a street
address or exit (the two KHP weigh stations with no published street/exit, the
two Kansas Turnpike Love's whose milepost is not a numbered exit, the Colby Pilot
with a conflicting phone, and the Shell Junction City with an unverified address).
They import cleanly and can be published once a field is verified.

## Corridor coverage (CO line → Salina/Hays → Junction City/Topeka)

- Distinct I-70 exits represented: **13** — 17, 54, 70, 76, 127, 145, 159, 184, 252, 253, 272, 295, 298 (plus the Topeka Mile-188 and Lawrence Mile-209 Turnpike service areas, whose mileposts are recorded in the description rather than as numbered exits)

## Rows by city (west → east)

| City | Rows |
| --- | --- |
| Goodland | 1 |
| Kanorado | 1 |
| Colby | 2 |
| Oakley | 4 |
| WaKeeney | 1 |
| Ellis | 1 |
| Hays | 2 |
| Russell | 1 |
| Salina | 3 |
| Abilene | 1 |
| Junction City | 3 |
| Alma | 1 |
| Topeka | 2 |
| Lawrence | 1 |

## Segments

- **A — West (8):** Oakley → Goodland → CO line (Exits 76–1): TA Oakley + its CAT Scale + Mitten truck repair, JJ Travel Stop (US-83), Pilot #920 Colby + its CAT Scale, 24/7 Travel Store Goodland, and the Kanorado KHP weigh station near the Colorado line.
- **B — Central (8):** Salina hub → WaKeeney (Exits 253–127): the **Salina cluster** (Petro #366, Flying J #659, Pilot #903), 24/7 Travel Store Russell, the **Hays pair** (Golden Ox, 24/7 Travel Store), Love's #455 Ellis, and 24/7 Travel Store WaKeeney.
- **C — East (8):** Junction City/Abilene + the Kansas Turnpike (Exits 298–272 + MP 188–209): Love's #732 Abilene, the Junction City pair (Sapp Bros. Travel Center + its truck wash, Shell Travel Center), the Love's-operated **Topeka (Mile 188)** and **Lawrence (Mile 209)** Turnpike service areas, a CAT scale at Love's #769 (I-70/US-75 north Topeka), and the Wabaunsee County (Alma) weigh station.

## Accuracy & exclusions

- Every row web-verified 2026-07-14 against official brand locators (Love's, Pilot/Flying J, TA/Petro, Sapp Bros., 24/7 Travel Stores, CAT Scale, KHP, ksturnpike.com) with directory/review sites as secondary confirmation. Per-row sources in `-sources.md`.
- No field invented: unverifiable address/ZIP/phone/exit values are blank (Colby Pilot phone, Shell address/phone, Topeka #175 street, both weigh-station mileposts).
- **Schema/honesty handling:** the two Kansas Turnpike service areas use mileposts, not numbered exits, so `exit_number` is left blank (the milepost is stated in the description) rather than forcing a non-conforming value; the Love's #769 CAT scale sits at the I-70/US-75 interchange and is described as such.
- **Researcher accuracy corrections honored:** a directory "Junction City Pilot at Exit 54" was excluded — that address (110 E Willow) is actually the Colby Pilot; the Oakley Exit-76 travel center is currently TA (operated by Mitten Inc.), not the stale "Love's" some directories still show. Small towns with no verified I-70 stop (Quinter, Grinnell, Grainfield, Brewster, Brookville, Ellsworth, Wilson) were omitted.
- **No cross-segment duplicates:** west/central/east cover disjoint exit ranges (17–76, 127–253, 272–298); 0 rows deduped.
