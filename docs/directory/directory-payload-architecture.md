# Directory payload architecture (DIR-PAYLOAD-1)

What the Directory's interactive pages send to a driver's phone, why it was
too much, what changed, and the line the next change has to stay under.

Measured 2026-08-20 against `scripts/bench/mock-postgrest.mjs` with
`MOCK_TEXT_PROFILE=production MOCK_FIELD_PROFILE=production`, from the
prerendered build artifacts. Row scale and field-presence rates come from the
live table, read read-only the same day.

---

## 1. Baseline

Brotli, because that is what Netlify serves a phone that accepts it.

| Route                      | Rows  | HTML raw   | gzip     | **Brotli** | RSC raw    | Cards rendered | DOM elements |
| -------------------------- | ----: | ---------: | -------: | ---------: | ---------: | -------------: | -----------: |
| `/directory/truck-stops`   | 1,882 | 3,361.2 kB | 297.4 kB | **203.0 kB** | 2,336.5 kB |             30 |          773 |
| `/directory/map`           | 1,940 | 4,521.5 kB | 320.6 kB | **220.5 kB** | 1,731.0 kB |      **1,940** |   **23,120** |
| `/directory/parking`       |   121 |   401.3 kB |  43.2 kB |    28.8 kB |   227.5 kB |             30 |        1,018 |
| `/directory/i55`           |    92 |   468.1 kB |  44.1 kB |    29.4 kB |   205.3 kB |             92 |        1,886 |
| `/directory/cat-scales`    |   100 |   356.2 kB |  38.0 kB |    25.7 kB |   197.5 kB |             30 |          957 |
| `/directory/washington`    |    47 |   231.7 kB |  26.9 kB |    18.7 kB |   120.8 kB |             22 |          709 |
| `/directory/truck-washes`  |   107 |   328.9 kB |  36.8 kB |    25.1 kB |   183.8 kB |             30 |          790 |

**Directory-data contribution** — the bytes in the document that exist because
of listings. Three parts, and a measurement that counts only the first is why
this went unnoticed:

| Route                    | Serialized rows | ItemList JSON-LD | Rendered cards | **Total Brotli** |
| ------------------------ | --------------: | ---------------: | -------------: | ---------------: |
| `/directory/truck-stops` |        114.8 kB |    44.7 kB (1,785 full objects) |        2.1 kB |     **161.5 kB** |
| `/directory/map`         |        125.3 kB |           0.5 kB |   **96.9 kB** |     **222.6 kB** |

On the map, the largest single item was the **rendered card list** — 1,940
result cards, 2.5 MB of markup, painted before a driver touched anything. No
measure of "how big is the data we serialize" can see it.

### Where the serialized bytes went

Per-field cost across the 1,882 rows on `/directory/truck-stops` (raw):

| Field | kB | | Field | kB | | Field | kB |
|---|---:|---|---|---:|---|---|---:|
| `amenities` | 120.3 | | `overnightStatusSource` | 68.0 | | `slug` | 44.9 |
| `detailSlug` | 107.1 | | `name` | 66.9 | | `lng` / `lat` | 85.9 |
| `description` | 83.5 | | `mileMarkerSource` | 58.8 | | `parkingSpaces` | 43.2 |
| `id` | 80.9 | | `address` | 53.3 | | `website` | 42.3 |
| `storedAmenities` | 73.3 | | `overnightStatus` | 51.5 | | `tpcUrl` | 40.4 |
| `createdAt` | 71.7 | | `mileMarker` | 47.8 | | `indexable` | 31.3 |
| `updatedAt` | 71.7 | | `verifiedAt` | 47.8 | | … | |

Two things stand out and neither is "there are a lot of listings":

- **Sparse fields still cost.** React's flight encoding writes an explicit
  `undefined` as the 12-byte string `"$undefined"`. `mileMarkerSource` is
  populated on **zero** rows and cost **58.8 kB** saying so.
- **Coordinate precision.** 34% of live geocoded rows carry 11–13 decimal
  places. Those digits are incompressible noise: rounding to six places (~11 cm)
  saved 12.2 kB Brotli on one page.

---

## 2. Field matrix

Which surface reads which field. `server` means a server module reads it and a
browser never needs to.

| Field | category index | category card | state/interstate | map filters | map card | marker | ItemList JSON-LD | server-only |
| --- | :-: | :-: | :-: | :-: | :-: | :-: | :-: | :-: |
| `id` | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ | aggregate key | |
| `name` | ✓ search + sort | ✓ | ✓ | | ✓ | ✓ | ✓ | |
| `city` | ✓ filter | ✓ | ✓ | ✓ filter | ✓ | | ✓ | |
| `state` | ✓ filter | ✓ | ✓ | ✓ filter | ✓ | | ✓ | |
| `category` | ✓ via `searchText` | ✓ group | ✓ group | ✓ filter | ✓ | ✓ icon | ✓ type | |
| `zip` | ✓ via `searchText` | ✓ | ✓ | ✓ search | | | ✓ | |
| `interstate` | ✓ via `searchText` | ✓ | ✓ | ✓ filter | ✓ | | | |
| `exitNumber` | ✓ via `searchText` | ✓ | ✓ | | ✓ | | | |
| `amenities` | ✓ via `searchText` | ✓ | ✓ | ✓ filter | ✓ | ✓ popup | | |
| `description` | ✓ via `searchText` | ✓ | ✓ | | | | | |
| `address` | | ✓ | ✓ | | ✓ | | ✓ | |
| `phone` | | ✓ | ✓ | | ✓ | ✓ popup | ✓ | |
| `website` | | ✓ | ✓ | | ✓ | ✓ popup | ✓ | |
| `parkingSpaces` | | ✓ | ✓ | | | | | |
| `tpcUrl` | | ✓ | ✓ | | ✓ | ✓ popup | | |
| `featured` | ✓ sort | ✓ badge | ✓ sort | ✓ sort | | ✓ colour | | |
| `createdAt` | ✓ sort | | ✓ sort | | | | | |
| `lat` / `lng` | ✓ distance sort | | | ✓ radius | ✓ directions | ✓ | ✓ geo | |
| `detailSlug` | | ✓ link | ✓ link | ✓ deep link | ✓ | ✓ popup | ✓ tail URL | |
| `slug` | | | | | | | | ✓ |
| `storedAmenities` | | | | | | | | ✓ indexability gate |
| `overnightStatus` | | | | | | | | ✓ FAQ builder, corridor |
| `mileMarker` | | | | | | | | ✓ corridor |
| `updatedAt` | | | | | | | | ✓ detail page, sitemap |
| `verifiedAt` | | | | | | | | ✓ ranking, trust |
| `indexable` | | | | | | | | **no reader anywhere** |
| `mileMarkerSource` | | | | | | | | **no reader anywhere** |
| `overnightStatusSource` | | | | | | | | **no reader anywhere** |

**Nine fields removed from the browser payload.** Three (`indexable`,
`mileMarkerSource`, `overnightStatusSource`) have no reader anywhere in `src/`;
six are read only by server modules that keep receiving whole rows.

No field was removed because a text search failed to find a consumer. Every
removal is asserted in `scripts/test-directory-payload.ts` against a fixture
whose rows carry values for it, and the card, the map filters and the
indexability gate are exercised over the same pool.

---

## 3. Options considered

**A — compact complete index + bounded card hydration.** Ship every listing in
a form that can be searched, filtered, sorted and counted; fetch card fields
for the window about to render. *Chosen for the category surface.*

**B — server-side search and pagination.** Move filtering behind an endpoint.
Rejected: it puts a network round trip in front of every keystroke for a driver
on a truck-stop connection, and it creates a second filtering truth that can
drift from the local one. It is also not needed — the index is small enough to
filter locally in ~1 ms.

**C — surface-specific DTOs only, no endpoint.** Measured: card DTO + bounded
ItemList = 109.8 kB, a **37.8%** cut against a 45% requirement. Honest and
simple, and it does not reach the bar. *Rejected on measurement.* Kept for the
state, corridor and map surfaces, where it does.

**D — hybrid.** A for the category pages, C for the map. *This is what shipped.*

### Why the map needs no endpoint

The map's filters (category, state, corridor, city, amenity) and its markers
are properties of the *complete* set — a map that fetches its markers is a map
that is wrong until it finishes. A narrowed DTO plus a bounded card list is
enough: **222.6 kB → 77.0 kB (65.4%)**.

---

## 4. What shipped

| Shape | Module | Used by | Contents |
| --- | --- | --- | --- |
| `DirectoryBrowseIndexEntry` | `lib/directory/dto.ts` | category + parking pages | `id`, `name`, `city`, `state`, `featured`, `createdAt` (epoch ms), `lat`/`lng` (6 dp), `searchText` |
| `DirectoryCardEntry` | `lib/directory/dto.ts` | `EntryCard`, `MultiCategoryBrowser`, card endpoint | the 20 fields a card renders and local browse reads |
| `DirectoryMapEntry` | `lib/directory/dto.ts` | `MapExplorer`, `LeafletMap` | the 17 fields markers, filters, cards, directions and deep links read |

- **`GET /api/directory/cards?ids=…`** — card fields for at most 60 ids.
  Rate-limited, zod-validated, anon client, `is_published`/`deleted_at`
  re-checked server-side, `s-maxage=300`. A lookup, not a search: no query text
  reaches the server, so there is no second filtering truth to drift.
- **One filter authority.** `filterAndSortEntries` is generic over a
  `BrowsableEntry`; the index carries `searchText` pre-joined by the same
  `buildSearchText` the client falls back to for card rows.
- **Bounded map list.** 30 cards per window, plus the selected listing when a
  marker outside the window is picked. Every listing stays in the pool, the
  count and the markers.
- **Bounded ItemList.** The first 30 entries carry a full `LocalBusiness`; the
  rest are `ListItem`s with a `url` to the detail page that already holds their
  schema. `numberOfItems` still counts every indexable listing.

### Encodings that changed a value

Only two, both stated so nobody has to rediscover them:

- `createdAt` ships as epoch milliseconds. ISO 8601 sorts lexicographically in
  the same order as the instants it names, so "Newest" is unchanged.
- `lat`/`lng` round to **6 decimal places (~11 cm)** in the browser payloads.
  40% of live rows already store exactly six. What reads them — distance
  sorting, whole-mile radius filtering, marker placement, a directions link —
  cannot resolve 11 cm.

---

## 5. Result

| Route | Directory data before | after | cut | Document before | after |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/directory/truck-stops` | 161.5 kB | **78.1 kB** | **51.7%** | 203.0 kB | 98.7 kB |
| `/directory/map` | 222.6 kB | **77.0 kB** | **65.4%** | 220.5 kB | 85.5 kB |
| `/directory/parking` | 15.8 kB | 8.7 kB | 44.9% | 28.8 kB | 21.3 kB |
| `/directory/i55` | 16.2 kB | 14.3 kB | 11.7% | 29.4 kB | 26.3 kB |
| `/directory/washington` | 8.2 kB | 7.4 kB | 9.8% | 18.7 kB | 17.6 kB |
| `/directory/cat-scales` | 14.0 kB | 7.5 kB | 46.2% | 25.7 kB | 18.9 kB |
| `/directory/truck-washes` | 14.6 kB | 7.8 kB | 46.4% | 25.1 kB | 17.9 kB |

The map's DOM went from **23,120 elements to 706**.

State and corridor pages move least because they were never the problem: at
live scale the largest (I-75, 407 rows) sits far inside the budget. They are in
the diff because they share `EntryCard`, and `EntryCard` now takes a card row.

---

## 6. Budget

Enforced by `scripts/bench/directory-payload.mjs`, which exits non-zero.

| Line | Value | Why |
| --- | --- | --- |
| Document | ≤ 150 kB Brotli | The same ceiling DIR-COMPLETE-2 set for the community pages, so the site has one answer. Sits under the heaviest route (`/trip-planner/classic`, ~148 kB First Load JS). |
| Listing data | ≤ 90 kB Brotli | Stricter and specific: a directory page is mostly listings, so a document budget alone would let the data eat the whole allowance. |
| Cards rendered | 30–120 | **A range.** Too many is the map defect. Too few is the failure a payload fix invites: a page that renders no cards is smaller on every byte measure and worse in every other way. The ceiling accommodates grouped pages (≤12 per group). |
| DOM elements | ≤ 4,000 | What the card count is a proxy for. The map was at 23,120. |

### The floor is not decoration

An early cut of this milestone rendered **zero** cards on every category page.
The window constant was exported from a `'use client'` module and imported by
the server component, where it arrived as a client-reference proxy — so
`slice(0, PAGE)` became `slice(0, NaN)` and returned `[]`. It typechecked, it
threw nothing, and it improved every byte number in the table. The prerendered
HTML had no listing cards and no server-rendered detail links for a crawler.

`DIRECTORY_PAGE` now lives in `lib/directory/browse.ts`. The bench asserts a
floor, and `DP80`/`DP81` assert the constant is a real number on the server.

---

## 7. What would force the next architecture

- **A category past ~2,130 listings.** Measured at the DIR-PAYLOAD-1
  production gate (2026-08-20) against merged `main`.

  > **Corrected.** This line first read "~4,000 listings", which was wrong and
  > wrong in the dangerous direction — it would have deferred the next
  > architecture well past the point where the budget actually breaks. That
  > figure divided the whole 90 kB data line by the index's per-row cost and
  > ignored everything else on the page that scales with row count.

  The marginal cost of one listing is **~42.6 bytes Brotli**, not 33.5:

  | Component | Per row (Brotli) | Scales with rows? |
  | --- | ---: | --- |
  | Compact browse index | 33.5 B | yes |
  | Bounded JSON-LD tail (`url`-only ListItems) | ~9.1 B | yes |
  | Initial card window (30 cards) | — | no, fixed ~1.4 kB |

  90 kB less the fixed card window, divided by 42.6 B, is **~2,130 rows**.
  `truck-stops` is at **1,882 — 88% of the line, with ~248 rows of headroom.**
  Publishing the 69 unpublished truck-stop rows already in the table takes it
  to ~1,951, or **92%**. Growth here is import-batch-driven rather than
  organic — every published row was created in a single 2026-07 import — so
  this line is crossed in one step, not gradually.

- **The map past ~2,279 coordinate-ready listings**, on the same measurement
  (~40 B Brotli per row against the same 90 kB line). Currently 1,940. The
  answer there is a cacheable map-data endpoint or viewport chunking, not
  fewer markers.

- **Search having to cover a field the index does not carry.** Anything new in
  the haystack lands in `searchText` for every row. A long field would need the
  endpoint to take a query — which is the moment the privacy rule changes and
  it must become a POST.

Neither byte line is crossed today, but the category line is close enough that
any directory import should be followed by `scripts/bench/directory-payload.mjs`
before the rows are published. `scripts/test-directory-payload.ts` (DP82) fails
if the stale "~4,000" figure reappears in this document.
