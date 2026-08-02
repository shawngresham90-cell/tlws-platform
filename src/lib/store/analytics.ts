/**
 * Store analytics event names. Fired through the shared vendor-agnostic
 * `trackEvent` dispatcher (lib/analytics.ts). Payloads carry only non-personal
 * context — product slug, category, placement — never any user data.
 */
export const STORE_EVENTS = {
  storeView: 'store_page_view',
  productView: 'store_product_view',
  categoryView: 'store_category_view',
  guideView: 'store_guide_view',
  picksView: 'store_picks_view',
  search: 'store_search',
  amazonCtaClick: 'store_amazon_cta_click',
  /** Direct (Stan) products. Slug + placement only — no user data, no price. */
  stanClick: 'store_stan_click',
  freeGuideClick: 'store_free_guide_click',
  coachingClick: 'store_coaching_click',
} as const;
