# Store product activation rules (first 12)

Activation = turning a product from a placeholder into a **live affiliate
listing** (active "View on Amazon" button + verified price/rating shown). It is
gated. A product may become active **only when ALL of the following are true**:

1. **Valid ASIN exists** — passes `isValidAsin` (10-char Amazon ASIN format).
2. **Verified Amazon title exists** — `verified_amazon_title` filled from the
   real listing.
3. **Required editorial description already exists** — the product has its
   Trucking Life write-up (description, pros, cons, Shawn's take) in
   `src/lib/store/products.ts`. *(The 4 net-new products below have no editorial
   entry yet — they need one added before they can activate.)*
4. **Main image exists OR the approved branded placeholder is used** — either a
   licensed `public/images/store/products/[id]/main.jpg`, or the safe branded
   icon tile (no unlicensed Amazon image, ever).
5. **Price present** — a confirmed `price_usd` (with a valid ASIN, this flips
   the product to "live" in the existing catalog model).

And every live link is **generated centrally**, never hand-entered:

- URL: `https://www.amazon.com/dp/[ASIN]?tag=truckinglif0d-20`
- Attributes: `rel="sponsored noopener noreferrer"`, opens in a new tab.
- The affiliate tag `truckinglif0d-20` lives only in `src/lib/store/amazon.ts`.

If any gate is unmet, the product stays a placeholder showing **"Amazon link
coming soon"** — which is always safe to have live. No fabricated ASIN, price,
rating, review count, discount, Prime/stock/best-seller claim, or scraped image
is ever used.

## The 12 products and their catalog mapping

| # | product_id | product_name | catalog status |
|---|---|---|---|
| 1 | `12v-cooler-fridge` | 12V Portable Fridge/Cooler | existing editorial slot |
| 2 | `dual-dash-cam` | Front-and-Cab Dash Camera | existing editorial slot |
| 3 | `full-size-cb-radio` | CB Radio | existing editorial slot |
| 4 | `memory-foam-seat-cushion` | Memory Foam Seat Cushion | existing editorial slot |
| 5 | `12v-portable-cooker` | 12V Electric Skillet | existing editorial slot |
| 6 | `rand-mcnally-road-atlas` | Rand McNally Motor Carriers' Road Atlas | **NEW — needs editorial entry** |
| 7 | `pen-inspection-light` | LED Trailer Inspection Flashlight | existing editorial slot |
| 8 | `bungee-ratchet-strap-set` | Bungee and Ratchet Strap Set | **NEW — needs editorial entry** |
| 9 | `windshield-sunshade` | Windshield Sunshade | **NEW — needs editorial entry** |
| 10 | `blood-pressure-monitor` | Blood Pressure Monitor | **NEW — needs editorial entry** |
| 11 | `compact-pure-sine-inverter` | CPAP-Safe Power Inverter | existing editorial slot |
| 12 | `over-ear-trucker-headset` | Bluetooth Trucker Headset | existing editorial slot |

## Owner workflow

1. Fill `docs/store/first-12-product-input.csv` (verified Amazon data only).
2. Drop licensed images into `public/images/store/products/[product-id]/`.
3. Run the validator:
   ```
   npx esbuild scripts/validate-first-12.ts --bundle --platform=node \
     --format=cjs --alias:@=./src --outfile=/tmp/validate-first-12.cjs \
     && node /tmp/validate-first-12.cjs
   ```
4. On a green validation (and after the 4 NEW products get editorial entries),
   the values are wired into the catalog and each product activates — behind a
   draft PR + full gate, no production writes until approved.
