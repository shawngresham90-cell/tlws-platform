# TA / Petro / TA Express — before / after coverage

Source of record: the current official location master (2026-07-27 download,
official sha256 `a0c612f0…63f7`; committed working copy `5ebe0e9f…3303`,
verified against all ten stated facts). Nothing below has been applied.

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

## Gate 4b — route-usable: 306 of 347 today → 344 after enrichment

| Step | Route-usable sites | Movement |
|---|--:|---|
| Today | **306** | 303 imported + TA Cartersville #146, TA Caryville, TA Lake Park #249 *(the published TA Atlanta South #268 duplicate also passes the filter but is the same site as its imported twin — 307 rows, 306 sites)* |
| After `CANARY-ENRICH` + `ENRICH-EXISTING` (38 rows) | **344** | 25 published rows gain their first coordinate, 11 gain their official space count, 2 gain both |
| Remaining | 3 | sites 0001 + 0142 (HOLD → verify → publish decision) and 0393 (correction B → publish decision) |

All 38 enrichment targets are **already published** — they are live pages a
driver can reach that today either have no map pin or no capacity figure. The
enrichment writes no publication state; it makes existing pages route-usable.

## Directory-wide movement (after canary + full enrich, nothing else)

| Measure | Before | After | Change |
|---|--:|--:|---|
| Live rows | 1,556 | 1,556 | none — **no inserts** |
| Published rows | 1,165 | 1,165 | none — **no publication changes** |
| Rows with coordinates | 534 | 572 | +38 |
| **Published rows missing coordinates** | **635** | **597** | **−38** |
| Featured / indexable | 0 / 0 | 0 / 0 | never written |
| Soft-deleted | 0 | 0 | **nothing is ever deleted** |

This is the first package in the whole program that *reduces* the published-
unmappable backlog: every one of the 25+2 coordinate fills lands on an
already-published page.

## Stated capacity

54,589 official truck-parking spaces across the 347-site 4b universe. The 11
spaces-only fills add 1,986 stated spaces to already-mappable published pages;
the 27 coordinate fills make 4,679 stated spaces mappable for the first time.

## What still does not pass

Gate 4a passes only at 348/348 — after correction B. Gate 4b passes only at
347/347 — after enrichment, HOLD verification, correction B, **and** the
publication decisions for the three unpublished rows. Each of those steps is a
separate authorization, and none has been given.
