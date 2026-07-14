/**
 * Store analytics event names. Fired through the shared vendor-agnostic
 * `trackEvent` dispatcher (lib/analytics.ts). Payloads carry only non-personal
 * context — product slug, category, placement — never any user data.
 */
export const STORE_EVENTS = {
  storeView: 'store_page_view',
  productView: 'store_product_view',
  categoryView: 'store_category_view',
  search: 'store_search',
  amazonCtaClick: 'store_amazon_cta_click',
} as const;
