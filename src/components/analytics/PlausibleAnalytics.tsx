/**
 * Environment-driven Plausible Analytics loader (Milestone: analytics
 * activation).
 *
 * Renders NOTHING unless `NEXT_PUBLIC_PLAUSIBLE_DOMAIN` is set, so every
 * environment without the variable (local dev, previews, forks) ships zero
 * analytics bytes and `trackEvent()` keeps its existing silent no-op
 * behavior. When the variable is set:
 *
 *  - an inline queue shim defines `window.plausible` immediately, so events
 *    fired before the vendor script arrives are queued, not lost;
 *  - the official script loads deferred from plausible.io and drains the
 *    queue. Pageviews are automatic; custom events keep flowing through the
 *    existing `trackEvent()` dispatcher (src/lib/analytics.ts), which already
 *    targets `window.plausible` — no event names or payloads change.
 *
 * Privacy/safety: the only value exposed to the client is the public site
 * domain (that is the entire Plausible client config — there is no secret).
 * Plausible is cookieless, so no consent banner is required.
 */
/** Queue stub, verbatim from Plausible's install docs. */
const QUEUE_SHIM =
  'window.plausible=window.plausible||function(){(window.plausible.q=window.plausible.q||[]).push(arguments)}';

export function PlausibleAnalytics() {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domain) return null;
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: QUEUE_SHIM }} />
      <script defer data-domain={domain} src="https://plausible.io/js/script.js" />
    </>
  );
}
