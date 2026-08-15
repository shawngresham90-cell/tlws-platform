'use client';

import { useState } from 'react';
import {
  ROUTE_PREFERENCE_SPECS,
  summarizePreferences,
  type RoutePreferences,
} from '@/lib/navigator/route-preferences';

/**
 * The driver's saved route preferences: one line, and a way in.
 *
 * WHY THIS IS NOT PART OF THE TRUCK. `avoid` used to be a field on the
 * truck profile, so turning tolls off was a TRUCK EDIT — it changed the
 * routing fingerprint, invalidated the confirmation, and sent the driver
 * back through "this is my truck" to say something about tolls. The pilot
 * asked for saved settings and got a truck re-confirmation.
 *
 * Editing a preference here changes a preference. It still invalidates
 * any route already built — the provider drew that line around a
 * different set of restrictions — but it never asks the driver to
 * re-verify their trailer height to avoid a toll booth.
 *
 * BOTH STATES ARE NAMED. The summary says "Tolls allowed" as plainly as
 * it says "Avoid tolls", because a missing line leaves a driver guessing
 * whether tolls are permitted or whether the app forgot to ask — and the
 * difference is money.
 */
export function RoutePreferencesPanel({
  prefs,
  onChange,
}: {
  prefs: RoutePreferences;
  onChange: (next: RoutePreferences) => void;
}) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <section
        aria-labelledby="route-prefs-heading"
        className="space-y-2"
        data-route-prefs="summary"
      >
        <div className="flex items-baseline justify-between gap-2">
          <h3 id="route-prefs-heading" className="text-xl font-bold text-ink">
            Route preferences
          </h3>
          <span className="text-base font-semibold text-ink/70">Saved</span>
        </div>
        <p className="text-lg text-ink" data-prefs-summary="">
          {summarizePreferences(prefs)}
        </p>
        <button
          type="button"
          onClick={() => setEditing(true)}
          data-edit-prefs=""
          className="min-h-16 w-full rounded-cockpit border border-line bg-nav-surface px-4 text-xl font-semibold text-ink"
        >
          Edit preferences
        </button>
      </section>
    );
  }

  return (
    <section aria-labelledby="route-prefs-heading" className="space-y-3" data-route-prefs="editing">
      <h3 id="route-prefs-heading" className="text-xl font-bold text-ink">
        Route preferences
      </h3>
      <p className="text-base text-ink/70">
        These change the route the provider builds. Changing one asks for a fresh route before you
        start.
      </p>
      <div className="space-y-2">
        {ROUTE_PREFERENCE_SPECS.map((spec) => {
          const on = prefs[spec.key];
          return (
            <button
              key={spec.key}
              type="button"
              aria-pressed={on}
              data-pref-toggle={spec.feature}
              onClick={() => onChange({ ...prefs, [spec.key]: !on })}
              className={`min-h-16 w-full rounded-cockpit border px-4 text-left text-xl font-semibold ${
                on ? 'border-nav-good bg-nav-good text-asphalt' : 'border-line text-ink'
              }`}
            >
              {on ? spec.onLabel : spec.offLabel}
            </button>
          );
        })}
      </div>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="min-h-16 w-full rounded-cockpit border border-line px-4 text-xl font-semibold text-ink"
      >
        Done
      </button>
    </section>
  );
}
