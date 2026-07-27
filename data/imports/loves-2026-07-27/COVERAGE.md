# Love's — before / after coverage

Source of record: `LovesSearchResults.xlsx`, sha256 `ec5146ee…a89ab2`,
**confirmed complete** against Love's own published count of 731 locations
across five location types and 42 operating states.

Nothing below has been applied. These are the figures the package produces when
insertion, enrichment and publication are each separately authorized.

---

## Source acquisition: 100 %

Gate line 2's *source* is complete: 731 of 731 locations held, all five store
types, all 42 operating states.

**Source acquisition being 100 % does not make directory coverage 100 %.** The
file being complete says nothing about whether the database represents it. The
two database gates below are what actually pass or fail.

## The two database gates, kept separate

| Gate | Universe | In the DB today | After this package |
|---|--:|--:|--:|
| **2a — Love's directory coverage** | **615** active Travel Stops | 62 reconciled | **615** |
| **2b — Love's overnight-parking coverage** | **604** with `overnightparking = Y` | 0 route-usable | **604** |

615 = 604 overnight-eligible + 11 non-overnight. Both figures come from the
same file and neither may be reported as the other.

### The 11 non-overnight Travel Stops

Real Love's locations, and they belong in the directory as **truck stops**.
They must **never** be offered as overnight or HOS-rest parking. The
`overnight_parking` flag carries the operator's own `N`, `PUBLISH-PER-STATE.sql`
filters on it, and `VERIFY.sql` §3 asserts zero non-overnight rows are ever
published as parking.

**#201 Elk City, OK** additionally states **0 spaces**. It does not qualify as
parking of any kind — it is a directory record only, and `VERIFY.sql` §4 checks
it by name.

## What the package moves

| | Rows |
|---|--:|
| Net-new inserts | **552** — 541 overnight-eligible + 11 non-overnight |
| Enrichment of existing rows (map pins) | **62** |
| Colocated service rows reconciled, **no pin** | **62** |
| Store-number conflicts held back | **2** (#618, #420) |
| Published by the import itself | **0** |

552 + 62 + 1 (the #420 conflict, held) = 615. Nothing unaccounted for.

## Corridors — the transformation

The directory currently has published parking on three corridors. Love's alone
puts overnight-eligible, mappable truck parking on **64**.

| Corridor | Published parking before | Love's overnight adds |
|---|--:|--:|
| **I-95** | **0** | **+14** |
| **I-80** | **0** | **+22** |
| **I-90** | **0** | **+23** |
| **I-94** | **0** | **+11** |
| **I-10** | **0** | **+36** |
| **I-15** | **0** | **+8** |
| I-40 | 12 | +39 |
| I-65 | 15 | +15 |
| I-75 | 30 | +22 |

Every corridor the launch gate names as a priority goes from **zero** to
covered. I-20 (+29), I-35 (+24) and I-70 (+24) also arrive from nothing.

## States

| | |
|---|--:|
| States with published parking today | **10** |
| States with overnight-eligible Love's | **42** |
| **States new to parking coverage** | **32** |

New: AZ CA CO CT IA ID IL KS LA MD MN MO MS MT ND NE NJ NM NV NY OK OR PA SC
SD TX UT VA WA WI WV WY.

## Directory-wide effect

| Measure | Before | After | Change |
|---|--:|--:|---|
| Published parking-capable locations | 76 | 680 | **+604** |
| …**mappable** | 31 | 635 | **+604** |
| Total published rows | 1,165 | 1,769 | +604 |
| Published rows missing coordinates | 635 | 635 | **unchanged** |
| Stated truck parking spaces | not tracked | **49,976** | new |

Every one of the 604 arrives **with** a coordinate — 604/604 mappable — so the
unmappable count does not grow. The pre-existing 635 unmappable rows are a
separate problem this package does not touch.

## Sponsorship inventory

Per `src/lib/directory/placements.ts`: one primary sponsor per corridor page,
up to three featured listings per page. Sixty-four corridor pages gaining real
content is **64 primary slots and up to 192 featured slots** that currently
have nothing to sponsor.

That is capacity, not revenue. No rate is implied, no prospect is named, and
whether any of it sells is unknown. `is_featured` is `false` on every inserted
row and no statement in this package sets it.

## What is still not passed

Gate 2a and 2b both read **in progress**, not ✅:

- Insertion, enrichment and publication are three separate authorizations and
  **none has been given**.
- 2 store numbers are held back pending verification (#618 Birch Run,
  #420 Florence) — see `CORRECTIONS.sql`.
- Route-segment coverage (gate lines 7 and 8) becomes *measurable* for the
  first time once these publish, but is not measured here.

The gate passes when the database represents all 615, not when the file does.
