'use client';

import { formatDimension, formatWeight } from '@/lib/navigator/format-units';
import { summarizePreferences, type RoutePreferences } from '@/lib/navigator/route-preferences';
import type { EditableProfile } from '@/lib/navigator/truck-profile';
import type { SetupStatus } from '@/lib/navigator/setup-status';

/**
 * Everything the driver already settled, in one block, below Start.
 *
 * THE COMPLAINT THIS ANSWERS, in the pilot's words: "There is too much
 * setup before starting... time is money, and it takes too long to get
 * moving." The audit measured it — 8,826 px of parked screen, with Start
 * Route 5,758 px down, on a driver who had already entered everything.
 * Nothing on that screen was wrong; it was all simply still open.
 *
 * So once the truck is confirmed, the six setup panels collapse to this
 * and the destination and Start Route move above it. A returning driver
 * reads four numbers and a preference line, taps Start, and goes.
 *
 * WHAT IT REFUSES TO HIDE. A collapse that buries a limitation is worse
 * than the long screen, because the driver now believes setup is
 * complete. So:
 *
 *   - The truck's ACTUAL NUMBERS are here, not the word "Confirmed".
 *     A driver who hooked a different trailer this morning has to be
 *     able to catch it without opening anything, and "Confirmed" would
 *     read as confirmation of whatever they are pulling today.
 *   - `clocksWarning` prints in full whenever the clocks are blank. HOS
 *     guidance being unavailable is a fact about the trip, and it must
 *     not be one of the things that got collapsed away.
 *   - Both preference states are named, so "Tolls allowed" is as visible
 *     as "Avoid tolls".
 *
 * IT EDITS NOTHING. This is a read-only echo with two ways back in:
 * **Edit truck** goes straight to the one truck editor, and **Change
 * setup** re-opens the whole stack. Neither is a second place to change
 * a value — the editors remain the only writers, so there is still
 * exactly one confirmation path after a truck changes.
 */
export function SetupSummary({
  status,
  profile,
  prefs,
  driverName,
  metric,
  onEditTruck,
  onOpenSetup,
}: {
  status: SetupStatus;
  profile: EditableProfile;
  prefs: RoutePreferences;
  driverName: string | null;
  metric: boolean;
  onEditTruck: () => void;
  onOpenSetup: () => void;
}) {
  const clocks = status.items.find((i) => i.key === 'clocks');

  return (
    <section aria-labelledby="setup-summary-heading" className="space-y-2" data-setup="collapsed">
      <div className="flex items-baseline justify-between gap-2">
        <h3 id="setup-summary-heading" className="text-xl font-bold text-ink">
          Your setup
        </h3>
        <span className="text-base font-semibold text-ink/70">Saved on this device</span>
      </div>

      <dl className="rounded-cockpit border border-line p-3 text-lg" data-setup-summary="">
        {driverName === null ? null : <Row label="Driver" value={driverName} />}
        {/* The numbers, not the word "Confirmed" — see above. */}
        <Row
          label="Truck"
          value={`${formatDimension(profile.heightFt, metric)} · ${formatWeight(
            profile.grossWeightLbs,
            metric,
          )} · ${profile.axles} axles`}
        />
        <Row label="Route" value={summarizePreferences(prefs)} />
        <Row label="Clocks" value={clocks?.value ?? 'Not set'} />
      </dl>

      {/* Never collapsed away: the consequence of blank clocks. */}
      {status.clocksWarning === null ? null : (
        <p role="status" className="text-base font-semibold text-ink">
          {status.clocksWarning}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onEditTruck}
          data-edit-truck=""
          className="min-h-16 flex-1 rounded-cockpit border border-line bg-nav-surface px-3 text-lg font-semibold text-ink"
        >
          Edit truck
        </button>
        <button
          type="button"
          onClick={onOpenSetup}
          data-open-setup=""
          className="min-h-16 flex-1 rounded-cockpit border border-line px-3 text-lg font-semibold text-ink"
        >
          Change setup
        </button>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 py-0.5">
      <dt className="text-ink/70">{label}</dt>
      <dd className="num-data font-semibold text-ink">{value}</dd>
    </div>
  );
}
