# Store product images (owner-supplied, licensed only)

One folder per product id: `public/images/store/products/[product-id]/`.

Each folder expects, when you have **licensed** images:

- `main.jpg` — primary product image
- `alt1.jpg` — optional gallery image
- `alt2.jpg` — optional gallery image

## Rules

- **Only licensed images.** Do not copy or hot-link Amazon product images. Use
  images you are permitted to use (e.g. supplied via the Amazon Product
  Advertising API under your associate account, manufacturer-authorized assets,
  or your own photos).
- Until a `main.jpg` is added, the product renders the safe **branded icon
  tile** (no image) — never a placeholder pretending to be the real product.
- Image paths in `docs/store/first-12-product-input.csv` must point inside this
  directory (`public/images/store/products/...`); the validator rejects any
  path outside it.

These folders are scaffolding only. They ship empty (`.gitkeep`) so the paths
exist for when you drop in licensed images.
