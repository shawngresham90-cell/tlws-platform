import type { StoreProduct } from './types';

/**
 * Public visibility for the Trucking Life Store catalog.
 *
 * ONE FLAG, ONE PREDICATE. Amazon affiliate products are temporarily hidden
 * from the customer-facing store while the direct (Stan Store) catalog is
 * prepared. Nothing is deleted: every product stays in
 * `ALL_STORE_PRODUCTS`, the Amazon URL engine, ASIN validation, the associate
 * tag, the analytics events, and the admin audit are all untouched and still
 * compile. Hiding is a *view* over the catalog, not a change to it.
 *
 * TO RESTORE AMAZON PRODUCTS: set `SHOW_AMAZON_PRODUCTS` to `true`. That is
 * the whole operation — every public surface (store browse, product pages,
 * categories, buying guides, Shawn's Picks, related products, sitemap) reads
 * through this predicate, so none of them needs editing.
 *
 * Deliberately NOT reusing `productActive()`: that is the *purchasability*
 * gate (valid ASIN + verified title + licensed image) and it answers a
 * different question. Every product is already inactive by that measure, yet
 * all 104 still render as browsable pages — which is exactly the thing this
 * flag has to stop. Overloading `productActive()` would tangle "we may link to
 * this" with "we may show this at all", and flipping one would silently move
 * the other.
 */

/**
 * Owner-controlled. `false` hides every Amazon affiliate product from all
 * public surfaces; `true` restores them exactly as they were.
 */
export const SHOW_AMAZON_PRODUCTS = false;

/**
 * Is this catalog entry an Amazon affiliate product?
 *
 * Today the answer is yes for the entire catalog: `StoreProduct` is an
 * Amazon-shaped contract (it requires `asin`, and carries `rating` /
 * `reviewCount` / `verifiedTitle` that only mean anything for an Amazon
 * listing), and the only purchase CTA it can render is the Amazon button.
 *
 * When direct Stan/digital/coaching/merch products are added they will carry a
 * `sellerType` discriminator, and this predicate narrows to that field without
 * any caller changing.
 */
export function isAmazonProduct(p: StoreProduct): boolean {
  return 'asin' in p;
}

/**
 * Should this product appear on public, customer-facing surfaces?
 *
 * `showAmazon` is injectable so tests can prove BOTH states of the switch
 * without mutating module state — a hide that cannot be shown to reverse is
 * not a hide, it's a deletion with extra steps.
 */
export function isPubliclyVisible(
  p: StoreProduct,
  showAmazon: boolean = SHOW_AMAZON_PRODUCTS,
): boolean {
  return isAmazonProduct(p) ? showAmazon : true;
}

/** The public view of a catalog. Non-mutating — returns a new array. */
export function publicProducts(
  products: readonly StoreProduct[],
  showAmazon: boolean = SHOW_AMAZON_PRODUCTS,
): StoreProduct[] {
  return products.filter((p) => isPubliclyVisible(p, showAmazon));
}
