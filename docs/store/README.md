# Trucking Life Store — owner fill guide (M54)

The store ships with **100 editorial product picks** across 19 product types and
7 categories. Trucking Life wrote the honest case for each pick (what it is,
pros, cons, Shawn's take). The **Amazon-specific facts are intentionally blank**
until you verify them:

| Field | Status until you fill it |
| --- | --- |
| `asin` | blank → **no active Amazon button** (shows "Amazon link coming soon") |
| `price_usd` | blank → no price shown (never guessed) |
| `rating` | blank → no star rating shown |
| `review_count` | blank → no review count shown |
| `image_path` | blank → branded icon tile (no unlicensed Amazon image) |

Nothing in the catalog is fabricated: no invented ASINs, prices, ratings,
reviews, discounts, Prime claims, inventory, or best-seller claims. A product
only becomes a live affiliate link once **you** supply a real ASIN + price.

## How to fill it in

1. Open **`docs/store/owner-fill-template.csv`** (one row per product, keyed by
   `slug`). The `editorial_name`, `category`, and `product_type` columns are
   there for reference — leave them as-is.
2. For each product you want to take live, fill the verified columns from the
   **real Amazon listing**:
   - `asin` — the 10-character ASIN (e.g. `B0XXXXXXXX`).
   - `verified_title` — the exact Amazon product title (optional; overrides the
     editorial name for display when set).
   - `price_usd` — the current price, whole dollars.
   - `rating` — the star rating (e.g. `4.6`).
   - `review_count` — the number of ratings.
   - `image_path` — a **licensed** image path you host (e.g. via the Amazon
     Product Advertising API), never a hot-linked Amazon URL.
3. A future importer will read this CSV into `src/lib/store/products.ts`. Until
   then the values can be pasted into the matching product entry by hand — the
   affiliate URL is generated automatically from the ASIN with the associate tag
   `truckinglif0d-20` (see `src/lib/store/amazon.ts`), applied in exactly one
   place.

## Compliance guardrails (do not remove)

- The associate tag `truckinglif0d-20` lives only in `src/lib/store/amazon.ts`.
- `amazonProductUrl()` returns `null` for a blank/invalid ASIN, so a placeholder
  can never render an active or dead Amazon button.
- Product JSON-LD emits an `offers` block only when a product is live (real ASIN
  + price) and an `aggregateRating` only when a verified rating **and** review
  count are present — never a fabricated rating.
- The FTC / Amazon Associates disclosure appears wherever affiliate links live.
- Track readiness at **`/admin/store`** — it lists every product missing an
  ASIN, price, rating, review count, or image, plus its live/placeholder status.
