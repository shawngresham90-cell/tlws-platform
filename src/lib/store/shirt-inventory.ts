/**
 * Founding Supporter shirt inventory — the SINGLE source of truth for the
 * remaining-stock figure. Every customer-facing "N left" surface must import
 * from here; a hardcoded count anywhere else is a bug (enforced by
 * scripts/test-shirt-inventory.ts, which fails on drift or stale copies).
 *
 * Inventory is code-configured (audited 2026-07-29: fulfillment runs through
 * the external Stan store checkout, and no database table tracks shirt
 * stock), so updating this constant IS the inventory update. Price,
 * description, sizes, the Founders Wall benefit, and checkout behavior live
 * elsewhere and are not affected by this number.
 */

/** Total edition size — "only 100 made" (fixed fact about the run). */
export const SHIRTS_TOTAL_RUN = 100;

/** Owner-approved remaining stock set to 7 on 2026-08-20; was 16. */
export const SHIRTS_LEFT = 7;
