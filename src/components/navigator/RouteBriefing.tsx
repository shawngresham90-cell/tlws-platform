'use client';

import type { ReactNode } from 'react';
import type { RouteBrief } from '@/lib/navigator/navigation-lifecycle';
import type { DestinationCandidate } from '@/lib/navigator-api/destination-search';
import { formatDriverDistanceMi } from '@/lib/navigator/format-units';
import { formatHM } from '@/lib/navigator/hos-strip';
import { summarizeRouteRoads } from '@/lib/navigator/route-brief';
import { TruckProfilePanel } from './TruckProfilePanel';

/**
 * The pre-drive flight briefing (Design Blueprint Phase 3): everything a
 * driver checks before committing to a route, on one parked surface.
 *
 * PRESENTATIONAL ONLY. Every value here is read from state that already
 * existed — the searched destination, the provider's distance/duration,
 * the truck profile the plan request actually carried, the provider's
 * own road names at their exact route miles, and the warnings the
 * validator let through. The Start control is handed the EXISTING
 * lifecycle transition by its parent; this component owns no navigation
 * state and imports none.
 *
 * Wording discipline (blueprint §7): facts, never verdicts. The screen
 * says what profile the route was planned with and what the provider was
 * asked to route around — it never says "truck-safe", "verified" or
 * "approved", because no logic in this repository can stand behind those
 * words.
 */
export function RouteBriefing({
  destination,
  totalMi,
  etaText,
  brief,
  plausibilitySlot = null,
  onStart,
  onDiscard,
}: {
  /** The place the driver searched and picked; null for coordinate entry. */
  destination: DestinationCandidate | null;
  /** Route length from the live view (provider-reported). */
  totalMi: number | null;
  /** Clock-time arrival from the existing ETA helpers; null when unknown. */
  etaText: string | null;
  /** The lifecycle's read-only briefing projection. */
  brief: RouteBrief | null;
  /** The existing route-plausibility advisory, unchanged. */
  plausibilitySlot?: ReactNode;
  onStart: () => void;
  onDiscard: () => void;
}) {
  const roads = brief === null ? [] : summarizeRouteRoads(brief.maneuvers, brief.distanceMiles);

  return (
    <section aria-labelledby="route-briefing-heading" className="space-y-4">
      {/* ---- destination ---------------------------------------------- */}
      <div>
        <p className="text-base font-semibold uppercase tracking-[0.15em] text-ink/60">
          Route briefing
        </p>
        <h3
          id="route-briefing-heading"
          className="mt-1 text-3xl font-semibold leading-tight text-ink"
        >
          {destination !== null ? destination.title : 'Destination set by coordinates'}
        </h3>
        {destination !== null && destination.address ? (
          <p className="mt-1 text-lg text-ink/70">{destination.address}</p>
        ) : null}
        {destination === null ? (
          <p className="mt-1 text-lg text-ink/70">Developer coordinate entry — no place record.</p>
        ) : destination.facility !== 'unknown' ? (
          <p className="mt-1 text-base text-ink/60">
            Facility type: {destination.facility.replace(/-/g, ' ')}
          </p>
        ) : null}
        {/* True for every route this build can plan: provenance is always
            'unknown' until a verified-entrance dataset exists. Stated as a
            quiet fact, not dressed as a warning — it never changes and a
            permanent amber banner would teach drivers to ignore amber. */}
        <p className="mt-2 text-base text-ink/60">
          Entrance unverified — the destination pin is the provider&apos;s front door, not a checked
          truck entrance.
        </p>
      </div>

      {/* ---- the numbers ---------------------------------------------- */}
      <dl className="grid grid-cols-3 items-end gap-2 rounded-cockpit border border-line bg-nav-surface px-3 py-2 text-center text-ink">
        <div>
          <dt className="text-base leading-tight text-ink/70">Distance</dt>
          <dd className="num-data whitespace-nowrap font-data text-[length:clamp(1.5rem,6.5vw,1.875rem)] font-bold leading-tight">
            {formatDriverDistanceMi(totalMi)}
          </dd>
        </div>
        <div>
          <dt className="text-base leading-tight text-ink/70">Time (h:mm)</dt>
          <dd className="num-data whitespace-nowrap font-data text-[length:clamp(1.5rem,6.5vw,1.875rem)] font-bold leading-tight">
            {brief !== null ? formatHM(brief.durationSeconds / 60) : '—'}
          </dd>
        </div>
        <div>
          <dt className="text-base leading-tight text-ink/70">Arrive</dt>
          <dd className="num-data whitespace-nowrap font-data text-[length:clamp(1.5rem,6.5vw,1.875rem)] font-bold leading-tight">
            {etaText ?? '—'}
          </dd>
        </div>
      </dl>

      {/* ---- major roads, the provider's own story -------------------- */}
      {roads.length > 0 ? (
        <div>
          <p className="text-base font-semibold text-ink/70">Major roads, in driving order</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {roads.map((r) => (
              <li
                key={r.name}
                className="rounded-cockpit border border-line bg-nav-surface px-3 py-2 text-lg text-ink"
              >
                <span className="font-semibold">{r.name}</span>{' '}
                <span className="num-data text-ink/70">{r.miles.toFixed(1)} mi</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* ---- the truck this route was planned for --------------------- */}
      {brief !== null ? <TruckProfilePanel truck={brief.truck} /> : null}

      {/* ---- warnings: only what the app genuinely knows -------------- */}
      {brief !== null && brief.warnings.length > 0 ? (
        <div className="space-y-2">
          {brief.warnings.map((w) => (
            <p
              key={w}
              className="rounded-cockpit border border-line border-l-4 border-l-nav-warn bg-nav-surface px-3 py-2 text-lg font-semibold text-ink"
            >
              <span aria-hidden="true">⚠ </span>
              {w}
            </p>
          ))}
        </div>
      ) : null}
      {plausibilitySlot}

      {/* ---- commit --------------------------------------------------- */}
      {/* One primary action, the blueprint's big green START — green is
          the action's own words plus color, never color alone. Discard is
          deliberately quieter: same reachable floor, none of the weight. */}
      <button
        type="button"
        onClick={onStart}
        className="min-h-[4.5rem] w-full rounded-cockpit bg-nav-good px-4 text-2xl font-bold text-asphalt"
      >
        Start navigation
      </button>
      <button
        type="button"
        onClick={onDiscard}
        className="min-h-16 w-full rounded-cockpit border border-line px-4 text-lg text-ink/80"
      >
        Discard route
      </button>
    </section>
  );
}
