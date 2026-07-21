# Books section completion report

Audit date: 2026-07-21. The Amazon catalog was audited from the build
environment via web search (Amazon, Goodreads, and image CDNs block direct
fetches from this sandbox — every claim below is from search-indexed Amazon
listings, with the two limitations disclosed at the bottom).

## Before / after

| metric | before | after |
| --- | --- | --- |
| Amazon books found published | 4 | 4 |
| Books on `/books` | 3 | **4** |
| Books on the homepage teaser | 3 (all **wrong titles**) | 4 (real titles, deep-linked) |
| Real cover images | 1 of 3 | 1 of 4 (see cover status) |
| Broken/missing purchase links | 0 broken; 1 book absent | 0 |
| ISBNs in Book SEO schema | 0 | 3 |

## The catalog (verified against Amazon search listings)

| # | title | ASIN | on site before? | cover | link |
| --- | --- | --- | --- | --- | --- |
| 1 | The Trucker’s Carnivore Cookbook (ISBN 9798284810675) | B0F9TT5S6G | yes | ✅ real (`/covers/truckers-carnivore-cookbook.jpg`) | `a.co/d/03cOB4V3` ✓ |
| 2 | The DOT Survival Guide (ISBN 9798288489280) | B0FDL26V8Q | yes | ⬜ branded placeholder | `/dp/B0FDL26V8Q` + associate tag ✓ (URL matches Amazon's listing exactly) |
| 3 | **Defensive Driving For Truck Drivers** (ISBN 9798292659631, pub. 2025-07-15, 142 pp) | B0FHQPQ3QR | **NO — missing** | ⬜ branded placeholder | `/dp/B0FHQPQ3QR` + associate tag — **added** |
| 4 | Discipline Over Everything | B0FK3XQL5S | yes | ⬜ branded placeholder | `/dp/B0FK3XQL5S` + associate tag (kept as shipped) |

## Issues found and fixed

1. **Missing book:** *Defensive Driving For Truck Drivers* was published
   July 2025 and never added. Added with full shelf treatment (title,
   description, who-it's-for, learn bullets, purchase link, schema). The
   marketing copy is new — owner should review wording before merge.
2. **Homepage teaser listed three books that don't exist.** The homepage
   Books section advertised "Carnivore In The Truck", "The HOS Bible", and
   "17 Years, Zero Violations" — none of these is a published Amazon title.
   Replaced with the four real books, each deep-linking to its shelf entry
   (`/books#slug`), in a responsive 4-up grid (2-up tablet, 1-up mobile).
3. **Title accuracy:** "DOT Survival Guide" → "The DOT Survival Guide"
   (matches the Amazon listing).
4. **SEO:** ISBNs added to the JSON-LD Book schema for the three books with
   known ISBNs; page meta description updated to name all four books.
   Existing ItemList/breadcrumb schema, `rel="noopener sponsored"` links,
   and the Amazon Associates disclosure are unchanged.

## Cover image status (honest limitation)

Only the Carnivore Cookbook has real cover art in the repo. **This sandbox
cannot download the other three covers**: Amazon product pages, Goodreads,
and both Amazon image CDNs refuse connections from the build environment
(HTTP 403 at the proxy). The page already renders an on-brand typographic
cover for any book without art, so nothing looks broken — but to get the
real covers up, either:

- upload the three cover JPGs (any size ≥ ~600 px tall) to `public/covers/`
  named `dot-survival-guide.jpg`, `defensive-driving-for-truck-drivers.jpg`,
  `discipline-over-everything.jpg` — wiring each in is a one-line change the
  page is already structured for, or
- send them in chat and I'll commit them.

## Verification limits (disclosed)

- Links are verified against the exact URLs Amazon's own search listings
  expose (titles 1–3); they cannot be click-tested from the sandbox.
- *Discipline Over Everything* (B0FK3XQL5S) is not yet surfaced by web
  search — the ASIN is the one the site already shipped. If that listing is
  wrong, correct it in `src/app/(marketing)/books/page.tsx`.
- If there is a 5th+ published title search hasn't indexed, name it (or the
  Amazon author-page URL) and it gets the same treatment.

## Layout

`/books`: featured book with priority cover, alternating full-width shelf
sections, 2-column info cards that stack on mobile — unchanged structure,
one more shelf. Homepage: FeatureGrid 4-up on desktop, 2-up tablet, 1-up
mobile. No redesign performed.
