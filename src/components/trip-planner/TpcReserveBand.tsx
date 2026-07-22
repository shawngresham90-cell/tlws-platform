'use client';

import { useEffect, useRef } from 'react';
import {
  TPC_AVAILABILITY_NOTE,
  TPC_DISCLOSURE,
  TPC_HOME_URL,
  TPC_PARTNER_NAME,
  TPC_PROMO_CODE,
  TPC_REL,
} from '@/lib/directory/tpc';
import {
  detourBucket,
  hosBucket,
  trackTpcNoResults,
  trackTpcReserveClicked,
  trackTpcResultsShown,
} from '@/lib/trip-planner/tpc-analytics';

/**
 * "RESERVE YOUR PARKING BEFORE YOUR CLOCK RUNS OUT" — the Phase 1 Truck
 * Parking Club band (docs/trip-planner/last-stop-engine.md §3). A separated,
 * labeled PARTNER unit: it never enters or reorders the organic stop list.
 *
 * Honesty rules enforced here:
 * - every number rendered comes from the server's reachability-filtered
 *   slots (arrival inside the driver's clocks minus the safety buffer);
 * - no pricing, no availability, no space guarantees — we hold no such
 *   data in Phase 1 (TPC_AVAILABILITY_NOTE says so on the band);
 * - the free option, when known, renders right below the partner cards,
 *   clearly labeled — free parking is never hidden to sell a reservation.
 *
 * Kill switch: set NEXT_PUBLIC_TPC_PLANNER_ENABLED=false to remove the
 * band entirely (owner-approved Phase 1 default is ON).
 */

const ENABLED = process.env.NEXT_PUBLIC_TPC_PLANNER_ENABLED !== 'false';

type Slot = {
  label: string;
  driveMinutes: number;
  arriveAtMs: number;
  hosRemainingMinAtArrival: number;
  detourMinutesEstimate: number;
  reason: string;
  candidate: {
    id: string;
    name: string;
    interstate: string | null;
    exitNumber: string | null;
    offRouteMiles: number;
    parkingSpaces: number | null;
    amenities: string[];
    reservationUrl: string | null;
  };
};

export type LastStopView = {
  usableDriveMin: number;
  bufferMin: number;
  noReservableOnCorridor: boolean;
  slots: Slot[];
};

const fmtHours = (min: number) => {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return h > 0 ? `${h}h ${m.toString().padStart(2, '0')}m` : `${m}m`;
};
const fmtTime = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

const RESERVABLE_ORDER = ['best-reservable', 'last-reservable', 'backup-reservable'] as const;
const SLOT_TITLES: Record<string, string> = {
  'best-reservable': 'Recommended reservable',
  'last-reservable': 'Last reservable',
  'backup-reservable': 'Backup reservable',
  'last-free': 'Last free stop',
};

function PromoCode() {
  return (
    <span className="inline-flex items-center gap-1 rounded-card border border-signal/60 px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-signal">
      Use code {TPC_PROMO_CODE}
    </span>
  );
}

export function TpcReserveBand({ lastStop }: { lastStop: LastStopView }) {
  const reservable = RESERVABLE_ORDER.map((l) => lastStop.slots.find((s) => s.label === l)).filter(
    (s): s is Slot => Boolean(s),
  );
  const free = lastStop.slots.find((s) => s.label === 'last-free');
  const hos = hosBucket(lastStop.usableDriveMin);
  const showFallback = reservable.length === 0;

  // One analytics event per plan result (bucketed, non-personal).
  const reported = useRef<LastStopView | null>(null);
  useEffect(() => {
    if (!ENABLED || reported.current === lastStop) return;
    reported.current = lastStop;
    if (showFallback) trackTpcNoResults({ hos });
    else trackTpcResultsShown({ count: reservable.length, hos, fallback: false });
  }, [lastStop, showFallback, hos, reservable.length]);

  if (!ENABLED) return null;

  return (
    <section
      aria-label={`Reservable parking — ${TPC_PARTNER_NAME} partner results`}
      className="rounded-card border border-line bg-asphalt-800 p-4"
    >
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
        Partner results · {TPC_PARTNER_NAME}
      </p>
      <h2 className="mt-1 font-display text-lg uppercase text-ink">
        Reserve your parking <span className="text-signal">before your clock runs out</span>
      </h2>

      {showFallback ? (
        <div className="mt-3">
          <p className="text-sm text-muted">
            {lastStop.noReservableOnCorridor
              ? 'No reservable lots are verified on this corridor yet.'
              : `Reservable lots exist on this corridor, but none are reachable inside your clock minus the ${lastStop.bufferMin}-minute safety buffer.`}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <a
              href={TPC_HOME_URL}
              target="_blank"
              rel={TPC_REL}
              onClick={() =>
                trackTpcReserveClicked({ slot: 'fallback', position: 0, hos, detour: 'n/a' })
              }
              className="inline-flex items-center justify-center rounded-card border border-ink/60 px-4 py-2.5 font-display text-base uppercase tracking-wide text-ink transition-colors hover:border-signal hover:text-signal"
            >
              Find parking on {TPC_PARTNER_NAME}
              <span aria-hidden="true">&nbsp;↗</span>
            </a>
            <PromoCode />
          </div>
        </div>
      ) : (
        <ol className="mt-3 space-y-3">
          {reservable.map((slot, i) => {
            const c = slot.candidate;
            const primary = i === 0;
            return (
              <li
                key={c.id}
                className={`rounded-card border border-line bg-cab p-3 ${primary ? 'placard-money' : ''}`}
              >
                <p className="text-[11px] font-bold uppercase tracking-wider text-signal">
                  {SLOT_TITLES[slot.label] ?? slot.label}
                </p>
                <p className="mt-0.5 text-sm font-semibold text-ink">
                  {c.name}
                  <span className="ml-2 font-normal text-muted">
                    {[c.interstate, c.exitNumber ? `Exit ${c.exitNumber}` : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </p>
                <p className="num-data mt-1 text-xs text-muted">
                  Arrive {fmtTime(slot.arriveAtMs)} · {fmtHours(slot.hosRemainingMinAtArrival)} left
                  on your clock · {c.offRouteMiles} mi off route
                  {c.parkingSpaces != null ? ` · ${c.parkingSpaces} spaces` : ''}
                </p>
                <p className="mt-1 text-xs italic text-muted">{slot.reason}</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  {c.reservationUrl && (
                    <a
                      href={c.reservationUrl}
                      target="_blank"
                      rel={TPC_REL}
                      onClick={() =>
                        trackTpcReserveClicked({
                          slot: slot.label,
                          position: i + 1,
                          hos,
                          detour: detourBucket(slot.detourMinutesEstimate),
                        })
                      }
                      className={
                        primary
                          ? 'inline-flex items-center justify-center rounded-card bg-signal px-4 py-2.5 font-display text-base uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600'
                          : 'inline-flex items-center justify-center rounded-card border border-ink/60 px-4 py-2.5 font-display text-base uppercase tracking-wide text-ink transition-colors hover:border-signal hover:text-signal'
                      }
                    >
                      Reserve parking
                      <span className="sr-only"> at {c.name} (opens in new tab)</span>
                      <span aria-hidden="true">&nbsp;↗</span>
                    </a>
                  )}
                  <PromoCode />
                </div>
              </li>
            );
          })}
        </ol>
      )}

      {free && (
        <div className="mt-3 rounded-card border border-line bg-cab p-3">
          <p className="text-[11px] font-bold uppercase tracking-wider text-marker">
            Free option · no reservation
          </p>
          <p className="mt-0.5 text-sm font-semibold text-ink">
            {free.candidate.name}
            <span className="ml-2 font-normal text-muted">
              {[
                free.candidate.interstate,
                free.candidate.exitNumber ? `Exit ${free.candidate.exitNumber}` : null,
              ]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </p>
          <p className="num-data mt-1 text-xs text-muted">
            Arrive {fmtTime(free.arriveAtMs)} · {fmtHours(free.hosRemainingMinAtArrival)} left on
            your clock · {free.candidate.offRouteMiles} mi off route
          </p>
          <p className="mt-1 text-xs italic text-muted">{free.reason}</p>
        </div>
      )}

      <p className="mt-3 text-xs text-muted">
        {TPC_AVAILABILITY_NOTE} Powered by {TPC_PARTNER_NAME}.
      </p>
      <p className="mt-1 text-xs text-muted">{TPC_DISCLOSURE}</p>
    </section>
  );
}
