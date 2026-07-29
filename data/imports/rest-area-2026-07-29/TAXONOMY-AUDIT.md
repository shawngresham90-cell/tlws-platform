# Rest-area taxonomy audit — read-only (2026-07-29)

The empty `category_slug='rest-areas'` (0 rows) is NOT the truth: a
name/description/type/source sweep across the live directory finds **235
candidates**, classified exactly once each. No reclassification or data
write was performed — this is the corrected read-only baseline.

| Taxonomy class | Rows | Published | Coords | With count | Overnight bool true | With interstate | States |
|---|---:|---:|---:|---:|---:|---:|---:|
| Public rest area | 46 | 3 | 1 | 5 | 0 | 45 | 12 |
| Welcome/information center | 33 | 8 | 2 | 0 | 1 | 31 | 14 |
| Service plaza/oasis | 4 | 2 | 3 | 0 | 1 | 2 | 4 |
| Public truck-parking area/turnout | 0 distinct (the 5 NTAD rows classify into the classes above by facility type) | | | | | | |
| Weigh/inspection station (kept separate, never recommendable parking without explicit truck-parking evidence) | 61 | 13 | 4 | 0 | 2 | 61 | 14 |
| Private parking (excluded from rest-area totals) | 90 | 65 | 31 | 6 | 54 | 89 | 12 |
| Operator facility / ambiguous → held | 1 (Pedro's / Porky's Truck Stop "South of the Border", SC, I-95 — private operator facility, token match only) | | | | | | |
| Duplicate/conflict | 0 detected in this sweep | | | | | | |

NTAD-5 placement: CA→public rest area (Gold Run, I-80) · CT→service plaza
(Darien SB, I-95) · ME→service plaza (Kennebunk NB, I-95) · DE→welcome/rest
(Smyrna, US 13) · VT→welcome center (Guilford, I-91 N).

Per-state (rest + welcome + plaza + ambiguous): AL 6 · AR 5 · CA 1 · CT 1 ·
DE 3 · FL 9 · GA 4 · IL 1 · IN 3 · KY 4 · MD 2 · ME 1 · MI 6 · NC 10 ·
OH 2 · SC 6 · TN 12 · VA 7 · VT 1. Corridor concentration (rest+welcome):
I-95 33 · I-40 19 · I-75 13 · I-65 10 · I-24 1 · no interstate 3.

Key gaps: only 3 of 46 public rest areas are published and only 1 has
coordinates; 0 candidates carry an overnight `confirmed` status (correct —
no state evidence yet); AK/HI/DC have zero candidates of any class.
