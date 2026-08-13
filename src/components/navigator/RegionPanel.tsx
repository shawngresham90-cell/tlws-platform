'use client';

import {
  canadaPilotStatus,
  crossBorderSearchLabel,
  CANADA_HOS_SHORT,
  CANADA_PARKING_NOTICE,
  REGION_LABELS,
  type Region,
  type UnitSystem,
} from '@/lib/navigator/region';

/**
 * Region, units, and the Canadian pilot's honest status (Canada
 * milestone).
 *
 * WHAT THIS CONTROL MEANS, stated on the control itself: choosing Canada
 * changes where the search looks and which units the driver reads. It
 * does not switch the app to Canadian hours-of-service rules, because
 * this pilot does not calculate them — so the HOS limit is printed right
 * here, beside the choice that makes a driver expect otherwise, rather
 * than being discovered later on the driving screen.
 *
 * It renders inside the driving screen's existing `edit-destination`
 * LockGate: region is a parked-only decision, through the shared
 * authority, with no motion rule of its own.
 */

const CHOICE =
  'min-h-16 flex-1 rounded-cockpit border px-4 text-xl font-semibold ' +
  'motion-safe:transition-colors motion-safe:duration-150';

export function RegionPanel({
  region,
  units,
  onRegion,
  onUnits,
}: {
  region: Region;
  units: UnitSystem;
  onRegion: (region: Region) => void;
  onUnits: (units: UnitSystem) => void;
}) {
  const status = canadaPilotStatus();
  return (
    <section aria-labelledby="region-heading" className="space-y-3">
      <div>
        <h3 id="region-heading" className="text-xl font-bold text-ink">
          Region
        </h3>
        <p className="text-base text-ink/70">
          Where you are searching, and the units you read. Your location is never used to change
          this for you.
        </p>
      </div>

      <div className="flex gap-2">
        {(['US', 'CA'] as const).map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={region === r}
            // Switching region also moves the driver to that region's
            // usual units — decided by the caller, through the one
            // `defaultUnitsFor` authority, so this panel never holds a
            // second opinion about what Canada reads. The unit control
            // below still overrides afterwards.
            onClick={() => onRegion(r)}
            className={`${CHOICE} ${
              region === r
                ? 'border-nav-good bg-nav-good text-asphalt'
                : 'border-line bg-nav-surface text-ink'
            }`}
          >
            {REGION_LABELS[r]}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {(
          [
            ['imperial', 'Miles / lb'],
            ['metric', 'Kilometres / kg'],
          ] as const
        ).map(([u, label]) => (
          <button
            key={u}
            type="button"
            aria-pressed={units === u}
            onClick={() => onUnits(u)}
            className={`${CHOICE} ${
              units === u
                ? 'border-nav-good bg-nav-good text-asphalt'
                : 'border-line bg-nav-surface text-ink'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-base text-ink/60">
        {region === 'CA' ? crossBorderSearchLabel('CA') : crossBorderSearchLabel('US')} is available
        on the search box when you need a route across the border.
      </p>

      {region === 'CA' ? (
        <>
          {/* The limit travels WITH the choice that creates the
              expectation — a driver who picks Canada learns here, not
              after they have trusted a clock. */}
          <div
            role="status"
            className="rounded-cockpit border border-line border-l-4 border-l-nav-warn p-3"
          >
            <p className="text-lg font-bold text-ink">{CANADA_HOS_SHORT}</p>
          </div>

          <div className="rounded-cockpit border border-line p-3">
            <h4 className="text-lg font-bold text-ink">Canadian pilot status</h4>
            <dl className="mt-2 space-y-1 text-lg">
              {status.map((row) => (
                <div key={row.label} className="flex justify-between gap-3">
                  <dt className="text-ink/70">{row.label}</dt>
                  <dd className={row.available ? 'text-ink' : 'font-semibold text-ink'}>
                    <span aria-hidden="true">{row.available ? '✓ ' : '— '}</span>
                    {row.value}
                  </dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-base text-ink/70">{CANADA_PARKING_NOTICE}</p>
          </div>
        </>
      ) : null}
    </section>
  );
}
