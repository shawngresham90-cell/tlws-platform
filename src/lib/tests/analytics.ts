/**
 * Practice-test analytics event names, fired through the shared vendor-agnostic
 * `trackEvent` dispatcher (lib/analytics.ts).
 *
 * `practice_test_completed` already existed inline in TestResults and is named
 * here so the whole funnel reads from one registry rather than from scattered
 * string literals. The two CTA events are new: the Academy and CDL Pre-School
 * cards have been on the results screen all along with no way to tell whether
 * anyone clicked them, which made the most valuable step in the funnel — a
 * student who just finished a test deciding what to do next — the only step
 * nobody could measure.
 *
 * Payloads carry test slug, runner mode, placement, and the results variant.
 * Never an email, a score, or anything else identifying: the completion event
 * already reports score separately and in aggregate.
 */
export const TEST_EVENTS = {
  /** A graded sitting finished. Fired once per attempt. */
  completed: 'practice_test_completed',
  /** The Academy card's CTA on the results screen. */
  academyCtaClick: 'practice_test_academy_cta_click',
  /** The CDL Pre-School card's CTA on the results screen. */
  preschoolCtaClick: 'practice_test_preschool_cta_click',
} as const;

/**
 * Which results screen the student was looking at when they clicked.
 *
 * `pass` and `fail` mirror the two headline variants. `drill` is its own value
 * rather than being forced into one of the other two: a saved-work drill runs a
 * hand-picked subset and deliberately shows no pass/fail verdict, so reporting
 * one here would invent a distinction the student never saw.
 */
export type ResultsVariant = 'pass' | 'fail' | 'drill';

export function resultsVariant(drill: boolean, passed: boolean): ResultsVariant {
  return drill ? 'drill' : passed ? 'pass' : 'fail';
}
