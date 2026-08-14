'use client';

import type { PlanMyDay } from '@/lib/trip-planner/plan-my-day';
import { PARKING_SHORTFALL_NOTE } from '@/lib/trip-planner/plan-my-day';
import { mayClaimLiveTraffic } from '@/lib/trip-planner/traffic';
import { ZONE_EXPLANATION } from '@/lib/trip-planner/clock-limit-marker';
import { CANADA_WEATHER_UNAVAILABLE } from '@/lib/trip-planner/route-weather-timing';

/**
 * The Plan My Day results, rendered from a plan that has already decided
 * what it is allowed to claim.
 *
 * THIS COMPONENT MAKES NO SAFETY DECISIONS. Every refusal reaching it —
 * an unmappable clock limit, a short parking list, unproven traffic, a
 * Canadian route — was settled by the pure engines, and the job here is
 * to render it without softening it. That is why there is no `??` filling
 * in a missing number and no branch that quietly hides a problem: if the
 * plan says it could not work something out, the driver reads that.
 */

const CARD = 'rounded-cockpit border border-line bg-nav-surface p-4';
/** 18px floor: this screen is read in a cab, often at arm's length. */
const BODY = 'text-lg leading-snug text-ink';
const MUTED = 'text-base leading-snug text-ink/70';

function clockTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function hoursMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
}

export function PlanResults({ plan }: { plan: PlanMyDay }) {
  return (
    <div className="mt-6 space-y-4" data-plan-results="">
      {/* ---- traffic ------------------------------------------------- */}
      <section className={CARD} aria-labelledby="traffic-heading">
        <h2 id="traffic-heading" className="text-xl font-bold text-ink">
          {/*
            "Live traffic included" is a claim about a number a driver is
            about to plan their night around, so it is only ever printed
            when the provider returned the free-flow baseline that proves
            traffic was applied. Everything else says so plainly.
          */}
          {mayClaimLiveTraffic(plan.traffic)
            ? 'Live traffic included'
            : 'Traffic status unavailable'}
        </h2>
        <p className={`mt-1 ${BODY}`} data-traffic-label="">
          {plan.traffic.label}
        </p>
      </section>

      {/* ---- the clock ----------------------------------------------- */}
      <section className={CARD} aria-labelledby="clock-heading">
        <h2 id="clock-heading" className="text-xl font-bold text-ink">
          Your driving time
        </h2>
        {plan.window === null ? (
          <p className={`mt-1 ${BODY}`} data-window-problem="">
            {plan.windowProblem}
          </p>
        ) : (
          <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-2">
            <dt className={MUTED}>Clock limit</dt>
            <dd className="num-data text-xl font-bold text-ink" data-clock-limit="">
              {hoursMinutes(plan.window.clockLimitMin)}
            </dd>
            <dt className={MUTED}>Recommended stop</dt>
            <dd className="num-data text-xl font-bold text-ink" data-stop-target="">
              {hoursMinutes(plan.window.stopTargetMin)}
            </dd>
            <dt className={MUTED}>Your buffer</dt>
            <dd className={BODY}>{plan.window.bufferMin} min</dd>
            <dt className={MUTED}>Limited by</dt>
            <dd className={BODY}>{plan.window.limitedBy}</dd>
          </dl>
        )}

        {/* The marker's three states, in the driver's words. */}
        <div className="mt-3" data-clock-marker={plan.clockLimit.kind}>
          {plan.clockLimit.kind === 'pin' ? (
            <p className={BODY}>Your clock-limit point is marked on the map.</p>
          ) : plan.clockLimit.kind === 'zone' ? (
            <>
              <p className={BODY}>
                Your clock runs out somewhere in the marked zone — about{' '}
                {plan.clockLimit.spanMinutes} minutes wide.
              </p>
              <p className={`mt-1 ${MUTED}`}>{ZONE_EXPLANATION}</p>
            </>
          ) : (
            <p
              className="rounded-cockpit border border-line border-l-4 border-l-nav-warn px-3 py-2 text-lg font-semibold text-ink"
              data-cannot-map=""
            >
              {plan.clockLimit.notice}
            </p>
          )}
        </div>
      </section>

      {/* ---- the break ----------------------------------------------- */}
      <section className={CARD} aria-labelledby="break-heading">
        <h2 id="break-heading" className="text-xl font-bold text-ink">
          30-minute break
        </h2>
        {plan.breakPlan === null ? (
          <p className={`mt-1 ${BODY}`}>Enter your clocks to plan the break.</p>
        ) : plan.breakPlan.required === false ? (
          <p className={`mt-1 ${BODY}`} data-break="none">
            {plan.breakPlan.reason}
          </p>
        ) : plan.breakPlan.required === null ? (
          <p className={`mt-1 ${BODY}`} data-break="unavailable">
            {plan.breakPlan.problem}
          </p>
        ) : (
          <div data-break="required">
            <p className={`mt-1 ${BODY}`}>
              Aim to be stopped by{' '}
              <span className="num-data font-bold">{clockTime(plan.breakPlan.byMs)}</span>
              {plan.breakPlan.targetMile === null ? null : (
                <> — about mile {plan.breakPlan.targetMile} of your route.</>
              )}
            </p>
            <p className={`mt-1 ${MUTED}`}>
              The break costs {plan.breakPlan.costsWindowMin} minutes of your 14-hour window, which
              never pauses.
              {plan.breakMarker?.kind === 'zone' ? ' Shown as a zone: timing here is coarse.' : ''}
            </p>
          </div>
        )}
      </section>

      {/* ---- parking -------------------------------------------------- */}
      <section className={CARD} aria-labelledby="parking-heading">
        <h2 id="parking-heading" className="text-xl font-bold text-ink" data-parking-headline="">
          {plan.parkingHeadline}
        </h2>
        {plan.parkingProblem === null ? null : (
          <p className={`mt-1 ${MUTED}`} data-parking-problem="">
            {plan.parkingProblem === PARKING_SHORTFALL_NOTE
              ? PARKING_SHORTFALL_NOTE
              : plan.parkingProblem}
          </p>
        )}

        <ul className="mt-3 space-y-3 list-none p-0" aria-label="Parking options">
          {plan.parking.map((choice) => (
            <li
              key={choice.candidate.id}
              className="rounded-cockpit border border-line p-3"
              data-parking-choice=""
            >
              <p className="text-xl font-semibold text-ink">{choice.candidate.name}</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                <dt className={MUTED}>Arrive</dt>
                <dd className="num-data text-lg font-semibold text-ink">
                  {clockTime(choice.arriveAtMs)}
                </dd>
                <dt className={MUTED}>Clock left</dt>
                <dd className="num-data text-lg font-semibold text-ink">
                  {hoursMinutes(choice.clockLeftMin)}
                </dd>
                <dt className={MUTED}>Off route</dt>
                <dd className={BODY}>
                  {choice.detourMiles} mi · ~{choice.detourMinutes} min
                </dd>
                <dt className={MUTED}>Booking</dt>
                <dd className={BODY}>{choice.reservable ? 'Reservable' : 'No reservation'}</dd>
              </dl>
              {choice.amenities.length > 0 ? (
                <p className={`mt-2 ${MUTED}`}>{choice.amenities.join(' · ')}</p>
              ) : null}
              <p className={`mt-1 ${MUTED}`} data-parking-source="">
                Record: {choice.source}. Parking availability is not guaranteed.
              </p>
            </li>
          ))}
        </ul>
      </section>

      {/* ---- weather --------------------------------------------------- */}
      <section className={CARD} aria-labelledby="weather-heading">
        <h2 id="weather-heading" className="text-xl font-bold text-ink">
          Route weather
        </h2>
        {plan.weather.ok === false ? (
          <div data-weather={plan.weather.reason}>
            <p className={`mt-1 ${BODY}`}>{plan.weather.notice}</p>
            {plan.weather.notice === CANADA_WEATHER_UNAVAILABLE ? (
              <a
                className="mt-2 inline-block min-h-12 text-lg underline decoration-line underline-offset-4"
                href="https://weather.gc.ca/warnings/index_e.html"
                rel="noreferrer noopener"
                target="_blank"
              >
                Open Environment Canada alerts
              </a>
            ) : null}
          </div>
        ) : plan.weather.matches.length === 0 ? (
          <p className={`mt-1 ${BODY}`} data-weather="clear">
            No trucking-relevant alerts on this route while you are expected to be on it.
          </p>
        ) : (
          <ul className="mt-2 space-y-2 list-none p-0" data-weather="matches">
            {plan.weather.matches.map((m, i) => (
              <li
                key={`${m.alert.headline}-${i}`}
                className="rounded-cockpit border border-line border-l-4 border-l-nav-warn p-3"
              >
                <p className="text-lg font-bold text-ink">{m.alert.headline}</p>
                <p className={`mt-1 ${MUTED}`}>
                  You reach this stretch around{' '}
                  <span className="num-data">{clockTime(m.reachesAtMs)}</span>
                  {m.coarse ? ' (timing here is coarse)' : ''}.
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ---- what this is not ------------------------------------------ */}
      <section className={CARD} aria-labelledby="limits-heading">
        <h2 id="limits-heading" className="text-xl font-bold text-ink">
          Before you rely on this
        </h2>
        <ul className="mt-2 space-y-1 list-none p-0">
          {plan.disclaimers.map((d) => (
            <li key={d} className={BODY} data-disclaimer="">
              {d}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
