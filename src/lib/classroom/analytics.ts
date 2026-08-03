/**
 * Supply the Classroom analytics event names. Fired through the shared
 * vendor-agnostic `trackEvent` dispatcher (lib/analytics.ts) — no second
 * analytics library, no personal information in any payload.
 *
 * Each event carries at most a `placement` string so the same CTA can be
 * told apart by where it was rendered. Nothing about the visitor is sent.
 */
export const CLASSROOM_EVENTS = {
  /** Homepage campaign CTA → /supply-the-classroom. */
  homeCtaClick: 'classroom_home_cta_click',
  /** Landing page → Amazon wishlist (primary action). */
  amazonClick: 'classroom_amazon_click',
  /** Landing page → Cash App (secondary action). */
  cashAppClick: 'classroom_cashapp_click',
} as const;

export type ClassroomEvent = (typeof CLASSROOM_EVENTS)[keyof typeof CLASSROOM_EVENTS];
