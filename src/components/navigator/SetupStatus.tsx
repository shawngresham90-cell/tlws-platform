'use client';

import type { SetupStatus as SetupStatusValue } from '@/lib/navigator/setup-status';

/**
 * The setup checklist — four lines at the top of the parked screen saying
 * what is done and what is still needed.
 *
 * It exists so a driver does not have to hunt. The parked screen carries
 * a name field, a region control, a truck editor, a clock editor and a
 * destination search; without a summary, "why can I not start?" is
 * answered by scrolling.
 *
 * STATE IS TEXT, NEVER COLOUR ALONE. Each row says "Confirmed",
 * "Required", "Not set" or "Optional" in words. The tick is
 * `aria-hidden` decoration on top of a sentence that already reads
 * correctly with no styling at all.
 *
 * It is not a fixed overlay. It scrolls with the page like everything
 * else, because a sticky bar on a 320-px phone costs more than it gives
 * — and because the map, the search results and the truck controls must
 * stay unobstructed.
 */
export function SetupStatus({ status }: { status: SetupStatusValue }) {
  return (
    <section aria-labelledby="setup-status-heading" className="space-y-2">
      <h3 id="setup-status-heading" className="text-xl font-bold text-ink">
        Before you start
      </h3>
      <dl className="rounded-cockpit border border-line p-3 text-lg">
        {status.items.map((item) => (
          <div key={item.key} className="flex justify-between gap-3 py-0.5">
            <dt className="text-ink/70">{item.label}</dt>
            <dd className={item.state === 'required' ? 'font-semibold text-ink' : 'text-ink'}>
              <span aria-hidden="true">{item.state === 'done' ? '✓ ' : '— '}</span>
              {item.value}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
