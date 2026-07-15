# Store product activation rules (first 12)

Activation = turning a product from a placeholder into a **live affiliate
listing** (active "View on Amazon" button). It is gated. A product may become
active **only when ALL required fields are present**:

- **valid ASIN** — passes `isValidAsin` (10-char Amazon ASIN format)
- **verified product title** — the exact Amazon title (`verifiedTitle`)
- **licensed main image exists** — a licensed `public/images/store/products/[id]/main.jpg`
  (never an unlicensed / scraped Amazon image)
- **Amazon affiliate URL validates correctly** — generated centrally as
  `https://www.amazon.com/dp/[ASIN]?tag=truckinglif0d-20`

**Optional fields** (do NOT block activation):

- price
- rating
- review count
- gallery images
- Shawn's Pick
- Driver Tested badge

If any **required** field is missing:

- the Amazon button stays **disabled**, and
- the product shows **"Amazon link coming soon."**

This gate is enforced in code by `productActive()` (`src/lib/store/products.ts`):
`isValidAsin(asin) && verifiedTitle && imageUrl`. The `AmazonCta` and
`StickyAmazonCta` components render an active link only when it returns true, so
a half-filled product (e.g. an ASIN but no title or image) can never produce a
live button. Offer JSON-LD additionally requires a verified price; rating
schema additionally requires a verified rating **and** review count — neither is
ever fabricated.

Every live link carries `rel="sponsored noopener noreferrer"` and opens in a new
tab. The affiliate tag `truckinglif0d-20` lives only in `src/lib/store/amazon.ts`.

## The 12 products and their catalog mapping

All 12 now have an editorial entry in `src/lib/store/products.ts` (the 4 net-new
products were added as editorial placeholders — no ASIN, price, rating, reviews,
or image). Each is ready for owner-fill; none is active.

| # | product_id | product_name | catalog status |
|---|---|---|---|
| 1 | `12v-cooler-fridge` | 12V Portable Fridge/Cooler | existing editorial slot |
| 2 | `dual-dash-cam` | Front-and-Cab Dash Camera | existing editorial slot |
| 3 | `full-size-cb-radio` | CB Radio | existing editorial slot |
| 4 | `memory-foam-seat-cushion` | Memory Foam Seat Cushion | existing editorial slot |
| 5 | `12v-portable-cooker` | 12V Electric Skillet | existing editorial slot |
| 6 | `rand-mcnally-road-atlas` | Rand McNally Motor Carriers' Road Atlas | **editorial placeholder created** |
| 7 | `pen-inspection-light` | LED Trailer Inspection Flashlight | existing editorial slot |
| 8 | `bungee-ratchet-strap-set` | Bungee & Ratchet Strap Set | **editorial placeholder created** |
| 9 | `windshield-sunshade` | Truck Windshield Sunshade | **editorial placeholder created** |
| 10 | `blood-pressure-monitor` | Blood Pressure Monitor | **editorial placeholder created** |
| 11 | `compact-pure-sine-inverter` | CPAP-Safe Power Inverter | existing editorial slot |
| 12 | `over-ear-trucker-headset` | Bluetooth Trucker Headset | existing editorial slot |

## Owner workflow

1. Fill `docs/store/first-12-product-input.csv` (verified Amazon data only).
2. Drop licensed images into `public/images/store/products/[product-id]/main.jpg`.
3. Run the validator:
   ```
   npx esbuild scripts/validate-first-12.ts --bundle --platform=node \
     --format=cjs --alias:@=./src --outfile=/tmp/validate-first-12.cjs \
     && node /tmp/validate-first-12.cjs
   ```
4. On a green validation, the verified values are wired into the catalog and each
   product with all required fields activates — behind a draft PR + full gate, no
   production writes until approved.
