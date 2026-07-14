/**
 * Amazon affiliate URL engine (Trucking Life Store).
 *
 * COMPLIANCE-FIRST. This is the ONLY place an Amazon affiliate URL is built,
 * so the associate tag is applied exactly once, everywhere. Rules baked in:
 *
 *  - A URL is produced ONLY for a real, validated 10-char ASIN. Placeholder
 *    catalog entries (asin === null / not yet supplied) return `null` here, so
 *    the UI cannot render an active "Buy on Amazon" button for a product whose
 *    ASIN, price, and image the owner hasn't confirmed yet.
 *  - No price is ever guessed or embedded. Price lives on the product record
 *    and is only rendered when the owner has filled it in.
 *  - Outbound links carry rel="sponsored noopener noreferrer" (see AmazonCta).
 */

/** Amazon Associates tracking tag (owner-supplied). Applied to every store link. */
export const AMAZON_ASSOCIATE_TAG = 'truckinglif0d-20';

/** Amazon Associates Operating Agreement requires this disclosure wherever links appear. */
export const AMAZON_DISCLOSURE =
  'As an Amazon Associate, Trucking Life earns from qualifying purchases.';
export const AMAZON_DISCLOSURE_SHORT = 'Amazon Associate — we earn from qualifying purchases.';

/** rel required on every affiliate link: paid endorsement + safe new tab. */
export const AMAZON_REL = 'sponsored noopener noreferrer';

/** A valid Amazon ASIN is exactly 10 chars: B + 9 alphanumerics, or a 10-digit ISBN. */
export function isValidAsin(asin: string | null | undefined): asin is string {
  if (!asin) return false;
  return /^(B[0-9A-Z]{9}|[0-9]{9}[0-9X])$/.test(asin.trim().toUpperCase());
}

/**
 * Affiliate product URL for a real ASIN — or null when the ASIN is missing or
 * not yet valid (placeholder). Callers MUST treat null as "no active button".
 */
export function amazonProductUrl(asin: string | null | undefined): string | null {
  if (!isValidAsin(asin)) return null;
  const clean = asin!.trim().toUpperCase();
  return `https://www.amazon.com/dp/${clean}/?tag=${AMAZON_ASSOCIATE_TAG}`;
}

/**
 * Tag-carrying storefront URL — the associate homepage. Safe to link even with
 * no product ASINs (it's the associate landing, not a fabricated product link).
 * Used only for the store's own "browse on Amazon" affiliate footer link.
 */
export function amazonStorefrontUrl(): string {
  return `https://www.amazon.com/?tag=${AMAZON_ASSOCIATE_TAG}`;
}
