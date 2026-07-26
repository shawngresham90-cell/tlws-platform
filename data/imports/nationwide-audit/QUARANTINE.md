# Nationwide audit — quarantined, held and unsupported rows (391)

The 391 unpublished rows that were **not** published, with the reason for each
class. Nothing here was geocoded, published, or modified. Quality outranks
quantity: a quarantined row is better than a low-confidence or misleading
listing, and the threshold was never weakened to raise the total.

## 1. Held / excluded networks — 101 rows

Name or description embeds Love's, Pilot, Flying J, Sapp Bros, Goasis or
Thorntons. Excluded by policy, untouched. Includes the CAT scales and truck
washes operated at those networks' sites, whose listing names carry the held
brand.

One row in this class, `44f54856` **S & B Truck Wash — Cartersville GA**,
already carried coordinates from an import predating this session
(`geocode_source = NULL`, `updated_at` 2026-07-11). It was not written by this
run and remains unpublished.

## 2. No usable street address — 216 rows

Rest areas, welcome centers, weigh stations, median plazas and mobile services
addressed by mile marker, direction or nothing at all — for example
"I-95 Southbound", "MM 199, EB and WB", "I-95 Median Service Plaza". The
repository's own Census pipeline already classifies these as
`highway-or-insufficient`; the TIGER matcher needs a house number. They cannot
be authoritatively geocoded and are **unsupported**, not rejected on merit.

**To resolve:** obtain a rooftop coordinate per row from an authoritative
DOT/operator source, cross-check it, then run the same geocode → publish flow.

## 3. Mission-excluded — 10 rows (of 28 such ids)

The 14 MD/DE quarantined Tier-1 rows, the 14 Tier-2 rows and the three deferred
I-95 plazas are out of scope for this milestone; 10 of those ids fall inside the
addressable pool and are excluded here.

## 4. Not in the Census batch — 32 rows

Addressable rows that were outside the committed Census batch input, so no
Census evidence exists on file for them. Two examples: `1ea6395c` Comfort Suites
Cullman and `50c293a2` Days Inn Clanton (AL).

**To resolve:** add them to a new batch input, submit through the documented
manual Census flow, then re-run the same Exact-only gate.

## 5. Census `Non_Exact` — 27 rows

The geocoder interpolated a position rather than matching the address exactly →
`medium` confidence under `census-geocoder.ts`, below the bar for publication.
Notably this class contains `74398e08` **TA Jacksonville South #248**, which is
*also* a confirmed duplicate of the published `f3ec3f7f` TA Jacksonville South
(same address, `1650 C.R. 210 West`) — it would have been excluded on duplicate
grounds regardless.

## 6. Category / evidence gate — 5 rows

| Row | Class | Reason |
|---|---|---|
| `1e57efa0` Quality Inn Seymour I-65 (IN) | held | hotel with no structured truck-parking evidence |
| `27c0d036` Rocky Mount Inn (NC) | held | hotel with no structured truck-parking evidence |
| `53c9e3df` Quality Inn Columbia I-65 (TN) | held | hotel with no structured truck-parking evidence |
| `d3f823ea` Days Inn & Suites Fort Pierce I-95 (FL) | held | hotel with no structured truck-parking evidence |
| `eb77e44b` I-75 Rest Area (Mile 82.5, both directions) (KY) | quarantined | mile-marker location, both directions ambiguous |

Hotels are published only where a **structured** parking field
(`free_parking`, `paid_parking`, `overnight_parking`, `reserved_parking`) is
set. A truck-parking claim appearing only in free-text description is not
accepted — publishing an ordinary hotel as a truck-parking hotel would be a
misleading claim. This is the same standard applied to the two MD hotels held in
the previous milestone.

**To resolve:** confirm truck parking from an authoritative source and record it
in the structured fields, then re-evaluate.

## Summary

| Class | Rows |
|---|--:|
| 1. Held / excluded network | 101 |
| 2. No usable street address | 216 |
| 3. Mission-excluded | 10 |
| 4. Not in the Census batch | 32 |
| 5. Census `Non_Exact` | 27 |
| 6. Category / evidence gate | 5 |
| **Total not published** | **391** |
| Published | 128 |
| **Unpublished rows audited** | **519** |
