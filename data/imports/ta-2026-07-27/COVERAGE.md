# TA / Petro / TA Express — before / after coverage

Source of record: the official location master artifact, committed 2026-07-27
as `locmaster20260727.xlsx` (sha256 `a0c612f0…63f7`) and verified against all
ten stated facts. **EXECUTED 2026-07-27**: the 10-row canary and the remaining
address-anchored enrichments were applied under Shawn's authorization — 37 of
38 rows written; **site 0269 TA Knoxville West quarantined** by the
coordinate-collision guard (its staged pin exactly matches the site's own
published CAT-scale and truck-service records; the guard was not weakened to
admit it). See `EXECUTION-RECORD.md` for the full audit.

## Denominators — kept separate, never collapsed

| | Count |
|---|--:|
| Official rows in the master | 354 |
| **Gate 4a universe — TA / Petro / TA Express directory coverage** | **348** |
| **Gate 4b universe — route-usable truck parking** | **347** |
| Held: Goasis (4) + Thorntons (2), separate and untouched | 6 |
| Zero-parking among TA brands (site 0347, TA Truck Service Franklin KY) | 1 |

`354 = 348 + 6`, and `348 = 347 + 1`. The seven zero-parking locations
(1 TA-brand + 6 held-brand) are **never counted as truck-parking coverage**.

**Route-usable** means all four at once: in the directory, published,
authoritative coordinate, positive official space count.

## Gate 4a — directory coverage: 347 of 348 today

Every TA-brand site has its own production row except **site 0393
Petro Florence**, whose row exists but is mislabeled "Love's Travel Stop #420"
(see `CORRECTIONS-PROPOSALS.sql` §B). Correction B takes 4a to **348 of 348**.

## Gate 4b — route-usable: was 306 of 347 → **343 applied 2026-07-27**

| Step | Route-usable sites | Movement |
|---|--:|---|
| Before execution | **306** | 303 imported + TA Cartersville #146, TA Caryville, TA Lake Park #249 *(the published TA Atlanta South #268 duplicate also passes the filter but is the same site as its imported twin — 307 rows, 306 sites)* |
| **After execution (applied)** | **343** | 24 published rows gained their first coordinate, 11 gained their official space count, 2 gained both — 37 rows total |
| **After closeout (2026-07-27, separate authorization)** | **344** | 0269 applied via a one-record exact-ID same-site exception; the Atlanta South duplicate unpublished (published 1165→1164, zero truck-stop pin collisions remain) |
| Remaining | 3 | sites 0001 + 0142 (exact-address verification impossible — both candidate rows have `address = NULL`), 0393 (correction B blocked by the published Blue Beacon Truck Wash pin at 3003 TV Rd — needs its own one-record exception) |

All 38 enrichment targets were **already published** — live pages a driver
can reach that had no map pin or no capacity figure. The enrichment wrote no
publication state; it made existing pages route-usable.

## Directory-wide movement (measured before and after execution)

| Measure | Before | After (measured) | Change |
|---|--:|--:|---|
| Live rows | 1,556 | 1,556 | none — **no inserts** |
| Published rows | 1,165 | 1,165 | none — **no publication changes** |
| Rows with coordinates | 534 | 560 | +26 — 24 `lat+lng` fills + 2 `lat+lng+spaces` applied; the 27th staged coordinate (site 0269) is quarantined |
| **Published rows missing coordinates** | **635** | **609** | **−26** |
| Featured / indexable | 0 / 0 | 0 / 0 | never written |
| Soft-deleted | 0 | 0 | **nothing is ever deleted** |

This is the first package in the whole program that *reduced* the published-
unmappable backlog: every applied coordinate fill landed on an
already-published page.

## Stated capacity

54,589 official truck-parking spaces across the 347-site 4b universe. The 13
space-count fills (11 spaces-only + 2 with coordinates) put 2,191 official
stated spaces onto published pages; the 26 applied coordinate fills made
4,503 stated spaces mappable for the first time (measured post-execution).

## What still does not pass

Gate 4a passes only at 348/348 — after correction B. Gate 4b passes only at
347/347 — after HOLD verification, correction B, the publication decisions for
the three unpublished rows, **and** a decision on quarantined site 0269. Each
of those steps is a separate authorization, and none has been given.
