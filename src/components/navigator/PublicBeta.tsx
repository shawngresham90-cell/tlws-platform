/**
 * What a public-beta visitor is told, and where.
 *
 * Public access removes the passcode screen — which was also, incidentally,
 * the thing that told every visitor they were entering something unfinished.
 * Losing the gate must not mean losing that sentence, so it moves onto the
 * surface itself, where it stays after the gate is gone.
 *
 * TWO PIECES, DELIBERATELY SEPARATE
 *
 * The BADGE is the compact standing label: three words beside the page's
 * eyebrow, on every visit, including the hundredth. It answers "what is
 * this" at a glance and takes a line of nothing.
 *
 * The NOTICE is the responsibility sentence. The onboarding cards already
 * carry "Signs win, always" — but onboarding is read once and then
 * remembered as done, which is correct for onboarding and wrong for this.
 * A driver who cleared their onboarding six weeks ago still needs the
 * sentence in front of them, so it is rendered on the page rather than
 * behind a first-run flow.
 *
 * WHAT THIS IS NOT
 *
 * Not a disclaimer, not legal text, not an interstitial, and not a gate.
 * There is nothing to accept, dismiss or click past: the brief says public
 * mode must add no new obstacle before route planning, and a modal asking a
 * driver to agree to something is exactly the obstacle it rules out. This
 * is an operating instruction in the same voice as the onboarding cards —
 * what to do when the app and a sign disagree.
 *
 * Server-rendered and static, so it cannot interact with the driving
 * overlay, the safety lock, or anything else the Fast Start work owns.
 */

/** The standing label. Compact by construction — it sits inline. */
export function PublicBetaBadge() {
  return (
    <span className="inline-flex items-center rounded-full border border-signal/50 bg-signal/10 px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide text-signal">
      Public Beta
    </span>
  );
}

/** The sentence a driver needs whether or not they ever saw onboarding. */
export function PublicBetaNotice() {
  return (
    <p className="rounded-card border border-line bg-asphalt-800 px-4 py-3 text-sm text-ink/80">
      <strong className="font-semibold text-ink">You are driving, not the app.</strong> Posted
      signs, posted restrictions and road closures govern. Verify height, weight and hazmat
      restrictions on your route, and if a sign and this screen disagree, follow the sign.
    </p>
  );
}
