# Correction audit — erroneous "Love's Travel Stop #420" (Florence, SC)

**READ-ONLY audit. No update performed. Nothing applied.** Prepared 2026-07-25
at the owner's instruction, as a separate workstream from the TA/Petro import.

## The record in question

| Field | Value |
|---|---|
| `id` | `beb05d53-db50-49cb-8790-ec01b45c8187` |
| `name` | **Love's Travel Stop #420** |
| `address` | **3001 TV Rd** |
| `city` / `state` / `zip` | Florence / SC / 29501 |
| `type` / `category_slug` | `truck_stop` / `truck-stops` |
| `website` | `https://www.loves.com/locations/420` |
| `interstate` / `exit_number` | I-95 / 169 |
| `lat` / `lng` | **NULL / NULL** |
| `phone` | NULL |
| **`is_published`** | **false** |
| `is_indexable` / `is_featured` | false / false |
| `source` | `csv-import` |
| `created_at` / `updated_at` | 2026-07-15 (never updated) |

**Mitigating fact: the record is unpublished and non-indexable, so it is not
visible to drivers and not in the sitemap.** The error is contained to the admin
dataset. There is no user-facing urgency, which is why a careful separate
correction pass is the right approach rather than a hurried edit.

## Evidence

**Owner-supplied (cited, not independently verified here — outbound fetch is
policy-denied in this environment, so I could not open either page):**

- Petro Florence **#0393** is officially at 3001 TV Rd, Florence, SC —
  `https://www.ta-petro.com/location/sc/petro-florence/`
- Love's identifies store **#420** as **Flowood, Mississippi**, not Florence,
  South Carolina — `https://www.loves.com/promos/storeswithtouch`

**Independently corroborated from the official TA/Petro workbook**
(`locmaster20260725.xlsx`, sha256 `5ebe0e9f0341…`), which I did read directly.
It confirms the owner's citation exactly, and shows TA runs **two separate
Florence SC sites**:

| Site ID | Loc ID | Brand | Name | Address | Lat / Lng | Phone |
|---|---|---|---|---|---|---|
| **0393** | 6393 | Petro | **Petro Florence** | **3001 TV Rd.**, Florence 29501 | 34.2665 / −79.7321 | 843-669-5736 |
| 0527 | 6527 | TA | TA Florence | 2301 W. Lucas Street, Florence 29501 | 34.2364 / −79.8065 | 843-292-0386 |

So **3001 TV Rd, Florence SC is Petro Florence #0393** — a TA/Petro site, not a
Love's. The Site ID matches the owner's `#0393` citation precisely.

## Corroborating context from production (read-only)

| Record | Address | Type | Published |
|---|---|---|---|
| Love's Travel Stop #420 | 3001 TV Rd | truck_stop | false |
| Blue Beacon Truck Wash #51 - Florence | **3003 TV Rd** | other | false |
| Petro / TA Florence (TravelCenters of America #195) | **2301 W Lucas St** | truck_stop | false |
| CAT Scale at Petro Florence | **2301 W Lucas St** | other | false |
| Pilot Travel Center #337 | 2015 W Lucas St | truck_stop | false |
| Pilot Travel Center #62 | 3006 N Williston Rd | truck_stop | false |

Two observations that matter:

1. **The location itself is real.** A Blue Beacon sits next door at 3003 TV Rd,
   and the erroneous record's own description says "adjacent to a Blue Beacon
   truck wash", at I-95 Exit 169. There genuinely is a truck stop at ~3001 TV
   Rd — the workbook says it is **Petro Florence**. The record has the right
   *place* and the wrong *brand*.
2. **A second, related error is likely.** The existing record
   *"Petro / TA Florence (TravelCenters of America #195)"* carries the address
   **2301 W Lucas St**, which the workbook assigns to **TA Florence (0527)**,
   not to Petro. Its name conflates both brands, and
   *"CAT Scale at Petro Florence"* repeats the same mis-attribution. So the
   Florence SC cluster appears to have **conflated TA Florence and Petro
   Florence into one mislabelled pair**.

## Suspect records (all unpublished)

| # | id | Current name | Suspected problem |
|---|---|---|---|
| 1 | `beb05d53-…` | Love's Travel Stop #420 | Wrong brand entirely. 3001 TV Rd is Petro Florence #0393. Love's #420 is reportedly Flowood, MS. |
| 2 | `8bf6630b-…` | Petro / TA Florence (TravelCenters of America #195) | Name conflates two distinct sites; address 2301 W Lucas St belongs to TA Florence (0527). |
| 3 | `595de56a-…` | CAT Scale at Petro Florence | At 2301 W Lucas St, i.e. the **TA Florence** address — likely "CAT Scale at TA Florence". |

## What still needs verifying before any correction

1. **Confirm Love's #420 = Flowood, MS** against Love's official locator (the
   owner's citation says so; I could not open it from here).
2. **Confirm whether a Love's exists in Florence SC at all.** If one does, it
   has a different store number and needs its own record. If not, record #1
   should not simply be re-pointed — it should be resolved as either a rename to
   Petro Florence or a deletion plus a clean insert.
3. **Confirm the store numbers** for both TA Florence and Petro Florence against
   TA's official pages (workbook Site IDs are 0527 and 0393; production says
   `#195`, which matches neither and needs explaining).
4. **Check `location_history`** for these three ids to see how the values were
   originally set.

## Correction options (for decision — none applied)

- **Option A — repoint record #1.** Rename `beb05d53-…` to *Petro Florence
  #0393*, keep the address, add TA's coordinates (34.2665 / −79.7321) and phone.
  Preserves the id and any inbound references. Risk: if a genuine Love's in
  Florence is later confirmed, its history is now tangled with a Petro record.
- **Option B — retire and re-insert.** Soft-delete `beb05d53-…` and insert
  Petro Florence #0393 cleanly from the workbook row (which is already held in
  the manual-review set). Cleanest provenance; loses the existing id.
- **Option C — full Florence cluster pass.** Resolve all three suspect records
  together, since #2 and #3 are entangled with #1. **Recommended** — fixing #1
  alone would leave the TA/Petro mislabelling in place.

My recommendation is **Option C**, executed after items 1–4 above are verified,
and only under a separate explicit authorization.

## Interaction with the TA/Petro import

`Petro Florence` (Site 0393) and `TA Florence` (Site 0527) are **both held in
the manual-review set and excluded from the approved insert**. So this import
cannot compound the error, and the Florence cluster can be corrected
independently on its own timeline.

## What was not done

No update · no soft-delete · no insert · no field overwritten · no `geo` write ·
nothing applied. This document is analysis only.
