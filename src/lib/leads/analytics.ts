/**
 * Newsletter analytics event names, fired through the shared vendor-agnostic
 * `trackEvent` dispatcher (lib/analytics.ts).
 *
 * WHY THERE ARE TWO. A repeat signup and a genuine new subscriber both return
 * 2xx from `/api/lead`, so a single event counted SUBMISSIONS, not subscribers.
 * The form's `done` flag is component state with no persistence, so a reload, a
 * client-side nav back, or a return visit re-rendered the form and fired it
 * again for the same address. Signup numbers drifted upward with no new people
 * behind them.
 *
 * Splitting them makes both numbers honest and keeps the repeat count, which is
 * itself worth seeing — a high `already_subscribed` rate means the form is
 * being shown to people who have already joined, which is a placement problem
 * rather than a growth signal.
 *
 * Both events carry NO properties. Nothing about who submitted, where from, or
 * what they typed reaches the analytics vendor: the identity of a subscriber is
 * not an analytics concern, and an event that carries none cannot leak one.
 */
export const NEWSLETTER_EVENTS = {
  /** A new lead row was created by this submission. One per subscriber. */
  captured: 'newsletter_lead_captured',
  /** The address was already on the list. The submission succeeded; nobody new joined. */
  alreadySubscribed: 'newsletter_already_subscribed',
} as const;

export type NewsletterEvent = (typeof NEWSLETTER_EVENTS)[keyof typeof NEWSLETTER_EVENTS];
