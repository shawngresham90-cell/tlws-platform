# Nationwide audit — accounting for all 519 unpublished rows

Every unpublished row in `public.locations` is accounted for in exactly one
class below. Nothing was silently discarded. Counts are live read-only results
(2026-07-26, `main` @ `4a7d873`, total 1,556 / published 1,037 / unpublished 519).

| # | Class | Rows | Disposition |
|---|---|--:|---|
| 1 | **Held/excluded network** — name or description embeds Love's, Pilot, Flying J, Sapp Bros, Goasis or Thorntons | **101** | excluded (policy) |
| 2 | **No usable street address** — mile-marker, median-plaza, directional-highway, or blank address | **216** | unsupported — cannot be authoritatively geocoded |
| 3 | **Mission-excluded** — 14 MD/DE quarantined Tier-1, 14 Tier-2, 3 deferred I-95 plazas (10 of which fall inside the addressable pool) | **10** | out of scope this milestone |
| 4 | **Not in the Census batch** — row was outside the committed batch input | **32** | unsupported — no Census evidence on file |
| 5 | **Census `Non_Exact`** — interpolated match, medium confidence | **27** | quarantined (below the high bar) |
| 6 | **Category/duplicate gate** — 4 hotels with no structured truck-parking evidence, 1 mile-marker rest area | **5** | held / quarantined |
| 7 | **APPROVED** — Census `Exact`, address agrees, in-state, non-duplicate | **128** | geocoded + published |
| | **TOTAL** | **519** | |

Classes 1–2 are reproducible with `ACCOUNTING.sql`; classes 4–7 come from the
committed Census results joined to that pool.

## Why class 2 is the largest bucket

216 of the 418 non-held unpublished rows carry no street address the TIGER
matcher can use — they are rest areas, welcome centers, weigh stations and
median plazas addressed by mile marker or direction ("I-95 Southbound",
"MM 199, EB and WB"). The repository's own Census pipeline already classifies
these as `highway-or-insufficient`. They need a rooftop coordinate from an
authoritative DOT/operator source before they can be published, exactly like
the three deferred I-95 plazas.

## Approved set (128) — by state and category

| State | Rows | | Category | Rows |
|---|--:|---|---|--:|
| OH | 23 | | truck-stops | 32 |
| NC | 19 | | parking | 29 |
| TN | 15 | | tire-repair | 18 |
| GA | 14 | | hotels-truck-parking | 15 |
| KY | 14 | | truck-washes | 12 |
| FL | 13 | | roadside-service | 10 |
| SC | 8 | | cat-scales | 6 |
| IN | 7 | | cdl-schools | 6 |
| AL / AR / VA | 5 each | | | |

## Standard applied to every approved row

1. Already exists in the database (no inserts).
2. `category_slug` is one of the nine the application supports and renders.
3. US Census batch **`Exact`** match — the project's own deterministic
   high-confidence rule (`census-geocoder.ts`).
4. Standardized address agrees with the row: same house number, ≥50 % street
   token overlap, same city, same state, same 5-digit ZIP. Two rows passed only
   after encoding the deterministic state-route equivalence `AR-124` ≡
   `STATE HWY 124`; nothing was matched loosely.
5. Coordinate inside that state's bounding box, never `0,0`.
6. No duplicate directory key and no unexplained coordinate-proximity collision.
7. Not a held network, and the name does not promote one.
8. Hotels only where a **structured** truck-parking field is set (never
   free-text description claims).
