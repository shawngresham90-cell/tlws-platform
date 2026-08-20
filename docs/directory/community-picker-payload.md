# Community listing pickers — completeness and payload budget

**DIR-COMPLETE-2, 2026-08-20.** Sets the payload budget for `/directory/submit`
and `/directory/reviews`, records the measurements the budget was chosen from,
and states what would force the picker's architecture to change.

---

## The defect this closes

`getListingRefs()` read the published listings with:

```
.order('state').order('city').order('name').limit(2000)
```

and handed the result to the shared `LocationPicker` on both pages.

Production holds **2,454** published, non-deleted locations (read 2026-08-20).
The cap was binding, and because the order was state-first the 454 rows it
dropped were not a random sample but the alphabetical tail:

| State | Published listings a driver could not find |
| ----- | ----------------------------------------: |
| TN    |                                        72 |
| TX    |                                       235 |
| UT    |                                        27 |
| VA    |                                        48 |
| WA    |                                        20 |
| WI    |                                        23 |
| WV    |                                         8 |
| WY    |                                        21 |
| **Total** |                                 **454** |

Every published listing in Texas and Wyoming was invisible to both pickers. A
driver reporting a correction, a closure, or leaving a review for any of them
was told:

> No published listing matches "…"

The read did not error, return empty, or 404. It succeeded and the answer was
wrong, which is why nothing caught it: a truncated read is neither an error
nor an empty result, so the empty-vs-error contract that guards the directory
pages could not see it.

The **fail-soft `[]` on error was the same defect in a second form**: "the
lookup is down" and "your truck stop is not in the directory" rendered as one
sentence, and only one of them was true.

---

## What changed

- `getListingRefsResult()` pages the complete set with `collectAllRows` — the
  same keyset scan the directory reads use, reused rather than copied.
- A short page ends nothing, so a PostgREST `db-max-rows` cap (the latent half
  of the defect, not observable in production today) cannot truncate the read
  either.
- Failure is reported. Both pages read the result form and pass an
  availability flag to the forms; the picker says the lookup is temporarily
  unavailable instead of claiming no match. Reporting a **new** location never
  needed the picker and is never blocked.
- `ListingRef.category` is gone. No consumer read it.

---

## Budget

Stated in **compressed transfer bytes for the whole document**, because that
is what a phone on a truck-stop connection actually receives. Netlify serves
Brotli where the client accepts it, gzip otherwise.

| Metric | Budget |
| ------ | -----: |
| Document, Brotli | **150 kB** |
| Document, gzip | **180 kB** |
| Pool size at which the local-array picker is the wrong shape | **5,000 listings** |

Two anchors, both from this repository rather than from taste:

1. **The site's own routes.** The heaviest interactive route in the build
   (`/trip-planner/classic`) ships ~148 kB of First Load JS; the shared
   baseline every page pays is ~88 kB. A one-off intake form whose compressed
   document approaches the size of the app's heaviest JS bundle is out of
   character for this site.
2. **What the page is for.** These are two forms a driver opens once, usually
   on a phone, to report a correction or leave a review. The listing pool is
   the page's only large payload.

150 kB Brotli sits under the site's heaviest existing route and leaves the
pool room to roughly double before the budget binds.

The budget lives in code, not only here:
`scripts/bench/community-picker-payload.mjs` exports `BUDGET` and prints a
verdict.

---

## Measurements

Both trees built with `next build` against `scripts/bench/mock-postgrest.mjs`
at `MOCK_TEXT_PROFILE=production`, which widens the fixture's name / city /
detail_slug to the live table's measured averages (26.0 / 8.4 / 37.2
characters). Bytes are read off the prerendered `.html` and `.rsc` artifacts.

### /directory/submit

| | before | after | delta |
| --- | ---: | ---: | ---: |
| Listing refs serialized | 2,000 | **2,454** | +454 (+22.7%) |
| Listing array, raw | 434.4 kB | 464.1 kB | +29.7 kB (+6.8%) |
| Served HTML, raw | 503.9 kB | 533.6 kB | +29.7 kB (+5.9%) |
| Served HTML, **gzip** | 51.2 kB | 57.8 kB | +6.6 kB (+12.9%) |
| Served HTML, **Brotli** | 38.9 kB | **43.4 kB** | +4.5 kB (+11.6%) |
| RSC/flight, raw | 414.4 kB | 442.7 kB | +28.3 kB |
| RSC/flight, Brotli | 34.1 kB | 38.5 kB | +4.4 kB |
| Route JS (first load) | 410.7 kB | 411.4 kB | +0.7 kB |

### /directory/reviews

| | before | after | delta |
| --- | ---: | ---: | ---: |
| Listing refs serialized | 2,000 | **2,454** | +454 (+22.7%) |
| Listing array, raw | 434.4 kB | 464.1 kB | +29.7 kB (+6.8%) |
| Served HTML, raw | 493.0 kB | 522.7 kB | +29.7 kB (+6.0%) |
| Served HTML, **gzip** | 49.3 kB | 55.9 kB | +6.6 kB (+13.4%) |
| Served HTML, **Brotli** | 37.8 kB | **42.2 kB** | +4.4 kB (+11.6%) |
| RSC/flight, raw | 415.1 kB | 443.4 kB | +28.3 kB |
| RSC/flight, Brotli | 34.1 kB | 38.5 kB | +4.4 kB |
| Route JS (first load) | 405.0 kB | 405.7 kB | +0.7 kB |

**Verdict: within budget.** 43.4 kB Brotli is **29% of the 150 kB line**.

### Why 22.7% more rows costs 11.6% more bytes

Two effects, both measured rather than assumed:

- **Compression.** The pool is extremely repetitive — 46 state codes, a
  handful of chain names, recurring city names, a `detail_slug` largely
  derived from the name and city already present in the same row. Raw size
  overstates transfer by roughly 12×. This is the single most important number
  in this document: raw 533.6 kB reads alarming and is not what anyone
  downloads.
- **Dropping `category`.** 27,645 bytes of values plus 34,356 bytes of
  repeated keys across the live pool, read by nothing. Removing it paid for
  most of the 454 added rows. It was removed because no consumer read it — not
  to improve this table; `detailSlug` is a larger field and stays, because the
  deep links need it.

### Filter timing, complete pool, shipped predicate

50 runs each after warm-up, over all 2,454 refs.

| Query | median | p95 | rows rendered |
| ----- | -----: | --: | ------------: |
| typical name (`pilot travel`) | 0.72 ms | 1.26 ms | 12 |
| city (`chattanooga`) | 0.65 ms | 0.98 ms | 12 |
| state code (`tx`) | 0.70 ms | 0.97 ms | 12 |
| worst case — one char matching nearly all (`a`) | 0.62 ms | 0.75 ms | 12 |
| worst case — no match, full scan (`zzzzzzzz`) | 0.63 ms | 1.05 ms | 0 |

Pool as JSON in memory: 276.5 kB (up from 225.1 kB).

At most 12 rows ever render, so a complete pool costs nothing in the DOM. The
worst case is a full scan of 2,454 short strings — about a millisecond, an
order of magnitude inside a frame.

### Build cost

| | before | after |
| --- | ---: | ---: |
| Static pages generated | 4,483 / 4,483 | 4,483 / 4,483 |
| Listing-ref requests, whole build | 1 | **5** |
| Listing-ref bytes over the wire | 406,568 | 425,811 (+4.7%) |
| Total database requests, whole build | 2,617 | 2,607 |

Five requests, not ten, for two pages: Next's fetch data cache serves the
second page's identical scan from the first page's. Both pages keep
`revalidate = 300`, so a newly imported listing becomes findable on exactly
the schedule it did before, with no redeploy.

The whole-build request totals differ by 10 in the *other* direction. That is
not a saving from this change — it is the directory's existing build memo
collapsing concurrent identical scans differently depending on render order,
and it varies run to run. The listing-ref count (1 → 5) is the only figure
here attributable to this milestone.

---

## What would force a different architecture

The local-array picker stays right while all of these hold:

- the complete document stays under the Brotli budget;
- worst-case filtering stays imperceptible (< ~5 ms);
- the pool stays under ~5,000 listings.

Past that, the smallest safe replacement is a **first-party bounded listing
search endpoint** — server-side filtering, a capped result set, and a separate
deep-link resolution path so `?listing=<slug>` still resolves without shipping
every slug to the browser. That is a real cost (a network round trip per
query, request-storm handling, a new endpoint to secure) and is not owed at
2,454 listings.

At the current growth rate the budget is not close to binding. Re-run
`scripts/bench/community-picker-payload.mjs` when the pool crosses 4,000.

---

## Collation note

The old query ordered in Postgres; the complete read pages by `id` and
restores presentation order in JavaScript. The database collates with **ICU
`en_US.UTF-8`** (`pg_database.datlocprovider = 'i'`). On the live punctuation
and case cases, `localeCompare` reproduces that order exactly and code-unit
comparison does not:

| Postgres (ICU en_US) | `localeCompare` | code-unit `<` |
| --- | --- | --- |
| `a-1 Truck` | `a-1 Truck` | `ACME Truck & Trailer` |
| `ACME Truck & Trailer` | `ACME Truck & Trailer` | `Alpha` |
| `acme truck and trailer` | `acme truck and trailer` | `Love's …` |
| `alpha` | `alpha` | `Zeta` |
| `Alpha` | `Alpha` | `a-1 Truck` |

So the visible order is preserved, not merely approximated. `id` is the final
tie-breaker; see the comment on `compareListingRefs` for why it is kept even
though a stable sort makes it currently unobservable.
