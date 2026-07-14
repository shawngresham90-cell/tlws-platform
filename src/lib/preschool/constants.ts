/**
 * CDL Pre-School — single source of truth for the Founding Student offer.
 *
 * Every surface (homepage card, sales page, wall, claim form, admin, schema,
 * tests) reads these values so the price, capacity, and checkout URL can never
 * drift between pages. The purchase URL is owner-supplied and must match the
 * Stan Store product exactly — it is asserted verbatim in scripts/test-preschool.ts.
 */

/** Founding Student price in whole US dollars. */
export const PRESCHOOL_PRICE_USD = 149;

/** Human formatting used everywhere the price renders. */
export const PRESCHOOL_PRICE_LABEL = '$149';

/** Total Founding Student spots. Hard cap — enforced in admin + DB, never exceeded publicly. */
export const FOUNDING_STUDENT_CAPACITY = 20;

/** Exact Stan Store checkout URL (owner-supplied). Do not append parameters. */
export const PRESCHOOL_PURCHASE_URL =
  'https://stan.store/TRUCKINGLIFEWITHSHAWN/p/cdl-preschool--founding-student';

/** rel required on every purchase link: paid/external + safe new-tab. */
export const PRESCHOOL_PURCHASE_REL = 'sponsored noopener noreferrer';

/** Public routes. */
export const PRESCHOOL_PATH = '/cdl-pre-school';
export const FOUNDING_WALL_PATH = '/cdl-pre-school/founding-students';
export const FOUNDING_CLAIM_PATH = '/cdl-pre-school/founding-student-claim';

/** Admin route. */
export const PRESCHOOL_ADMIN_PATH = '/admin/cdl-preschool/founding-students';

/**
 * Analytics event names (Phase 11). Values only — no personal data is ever
 * attached to these events (asserted in tests).
 */
export const PRESCHOOL_EVENTS = {
  pageView: 'preschool_page_view',
  purchaseCtaClick: 'preschool_purchase_cta_click',
  curriculumExpand: 'preschool_curriculum_expand',
  claimStarted: 'founding_student_claim_started',
  claimSubmitted: 'founding_student_claim_submitted',
  /** Conversion instrumentation — payloads carry placement/percent/question only. */
  scrollDepth: 'preschool_scroll_depth',
  faqOpen: 'preschool_faq_open',
  navClick: 'preschool_nav_click',
} as const;

/** External checkout disclosure shown next to every purchase CTA. */
export const CHECKOUT_DISCLOSURE =
  'Checkout opens in a new tab on Stan Store, our secure payment partner. We never collect card details on this site.';
