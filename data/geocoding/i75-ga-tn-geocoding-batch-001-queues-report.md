# Geocoding queues — i75-ga-tn-geocoding-batch-001

Generated read-only from `i75-ga-tn-geocoding-batch-001.csv`. No coordinates were applied and no database was touched.

- **Total rows:** 139
- **Ready:** 45 — pass all gates (action=ready, confidence=high, valid coordinates); safe to apply after admin selection.
- **Manual review:** 82 — have a candidate coordinate but need a human (low/medium confidence or action=manual-review).
- **Rejected:** 12 — must not be applied as-is (skip, unresolved, or missing/invalid coordinates).

## By confidence

| Confidence | Rows |
| --- | --- |
| low | 19 |
| medium | 63 |
| high | 45 |
| unresolved | 12 |

## By action

| Action | Rows |
| --- | --- |
| manual-review | 82 |
| ready | 45 |
| skip | 12 |

## Duplicate proposed coordinates

18 coordinate(s) shared by more than one listing (likely a reused anchor or copy/paste — review before applying):
- `31.138574, -83.444919` → Adel Truck Plaza | CAT Scale — Adel Truck Plaza, Adel (2 listings)
- `32.612278, -83.744515` → CAT Scale — Pilot Travel Center #267, Byron | Pilot Travel Center #267 (2 listings)
- `34.443856, -84.915181` → CAT Scale — Love's Travel Stop #735, Calhoun | Love's Travel Stop #735 (2 listings)
- `34.272701, -84.807736` → CAT Scale — Pilot Travel Center #67, Cartersville | Pilot Travel Center #67 | S & B Truck Wash — Cartersville (3 listings)
- `34.273972, -84.807762` → CAT Scale — TA Cartersville | TA Cartersville #146 | TA Truck Service - TA Cartersville (3 listings)
- `32.717528, -83.733418` → CAT Scale — Love's Travel Stop #698, Macon | Love's Travel Stop #698 (2 listings)
- `31.415715, -83.503054` → Love's Travel Stop #325 | Love's Truck Care - Tifton #325 (2 listings)
- `30.77424, -83.29849` → CAT Scale — Love's Travel Stop #550, Valdosta | Love's Travel Stop #550 (2 listings)
- `35.469129, -84.652949` → CAT Scale — Speedway #7147, Athens | Speedway #7147 (2 listings)
- `35.291951, -84.818048` → Love's Travel Stop #364 | Love's Truck Care - Love's Travel Stop #364 (2 listings)
- `36.11107, -84.020183` → CAT Scale — Pilot Travel Center #403 (ONE9 Travel Center), Heiskell | ONE9 Travel Center #403 (2 listings)
- `35.873428, -84.235435` → CAT Scale — Petro Knoxville #312, Knoxville (Watt Road) | Petro Knoxville | TA Truck Service - Petro Knoxville (3 listings)
- `35.8731, -84.2379` → CAT Scale — TA Knoxville West #269, Knoxville (Watt Road) | TA Knoxville West | TA Truck Service - TA Knoxville West (3 listings)
- `35.733196, -84.397797` → CAT Scale — Love's Travel Stop #861, Loudon | Speedco at Love's Travel Stop #861 (2 listings)
- `35.153142, -84.952948` → CAT Scale — Pilot Travel Center #481, McDonald (Cleveland) | Pilot Travel Center #481 (2 listings)
- `35.545167, -84.565514` → CAT Scale — Pilot Travel Center #4598, Niota | Pilot Travel Center #4598 | Southern Tire Mart at Pilot - Niota (3 listings)
- `36.3771, -84.2463` → CAT Scale — TA Caryville #255, Pioneer | TA Caryville | TA Truck Service - TA Caryville (3 listings)
- `35.6015, -84.4668` → Circle K #3626 (former Kangaroo Express) | Quality Inn West Sweetwater (2 listings)

## Queue files

- `i75-ga-tn-geocoding-batch-001-queue-ready.csv`
- `i75-ga-tn-geocoding-batch-001-queue-manual-review.csv`
- `i75-ga-tn-geocoding-batch-001-queue-rejected.csv`

Each queue CSV keeps the full 15-column geocoding contract plus a `queue_reasons` column, so it re-parses cleanly through `parseGeocodingCsv` and can be fed back into the console.
