'use client';

import { useEffect, useMemo, useState } from 'react';
import type { PlannerAnchor } from '@/lib/trip-planner/directory-loader';

/**
 * Trip Planner client UI (Phase 4). Mobile-first, single column, big touch
 * targets — built for a driver on a phone in the cab. All planning happens
 * server-side via POST /api/trip-planner/quote; this component only collects
 * inputs and renders the result. No secrets, no provider calls in the
 * browser.
 */

type QuoteResponse = {
  ok: boolean;
  error?: { code: string; message: string; problems?: string[] };
  routeSummary?: {
    miles: number;
    driveMinutes: number;
    isEstimate: boolean;
    method: string;
    instructions?: string[];
  };
  remainingAtDeparture?: {
    drivingMin: number;
    windowMin: number;
    untilBreakMin: number;
    cycleMin: number;
    limitedBy: string;
    legalDrivingMin: number;
  };
  itinerary?: {
    stops: {
      kind: string;
      label: string;
      routeMile: number;
      arriveAtMs: number;
      departAtMs: number;
      dwellMinutes: number;
      reason: string;
      candidate: {
        name: string;
        parkingSpaces: number | null;
        reservationUrl: string | null;
        amenities: string[];
      } | null;
      alternates: { name: string; parkingSpaces: number | null }[];
    }[];
    arriveAtMs: number;
    totalMinutes: number;
    driveMinutes: number;
    restMinutes: number;
  };
  cost?: { fuelGallons: number | null; fuelCents: number | null; notes: string[] };
  fuelPrice?: { centsPerGallon: number; period: string; region: string; source: string } | null;
  weather?: {
    bands: { fromMile: number; toMile: number; summary: string; severity: string }[];
    alerts: { headline: string; severity: string }[];
  };
  candidatesAvailable?: number;
  warnings?: string[];
  disclaimer?: string;
  routingDisclaimer?: string;
};

const HAZMAT_OPTIONS: [string, string][] = [
  ['', 'None'],
  ['1', 'Class 1 — Explosives'],
  ['2', 'Class 2 — Gases'],
  ['3', 'Class 3 — Flammable liquids'],
  ['4', 'Class 4 — Flammable solids'],
  ['5', 'Class 5 — Oxidizers'],
  ['6', 'Class 6 — Poison'],
  ['7', 'Class 7 — Radioactive'],
  ['8', 'Class 8 — Corrosives'],
  ['9', 'Class 9 — Miscellaneous'],
];

const input =
  'w-full rounded-card border border-line bg-asphalt-800 px-4 py-3 text-base text-ink ' +
  'focus:border-signal focus:outline-none';
const labelCls = 'mt-4 block text-xs font-semibold uppercase tracking-wide text-muted';

const fmtHours = (min: number) =>
  `${Math.floor(min / 60)}h ${min % 60 ? `${min % 60}m` : ''}`.trim();
const fmtTime = (ms: number) =>
  new Date(ms).toLocaleString(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
const STOP_ICON: Record<string, string> = {
  origin: '🚚',
  destination: '🏁',
  fuel: '⛽',
  break: '☕',
  overnight: '🛏️',
  parking: '🅿️',
  weather: '🌧️',
};

export function TripPlannerApp({ anchors: initialAnchors }: { anchors: PlannerAnchor[] }) {
  const [anchors, setAnchors] = useState(initialAnchors);
  // Resilience: if the server-rendered list came back empty (cold cache,
  // transient directory failure), retry once through the API.
  useEffect(() => {
    if (initialAnchors.length > 0) return;
    void fetch('/api/trip-planner/anchors')
      .then((r) => r.json())
      .then((d: { ok: boolean; anchors?: PlannerAnchor[] }) => {
        if (d.ok && d.anchors?.length) setAnchors(d.anchors);
      })
      .catch(() => {});
  }, [initialAnchors]);
  const [originId, setOriginId] = useState('');
  const [destinationId, setDestinationId] = useState('');
  const [departLocal, setDepartLocal] = useState('');
  const [drivingUsed, setDrivingUsed] = useState(0);
  const [windowUsed, setWindowUsed] = useState(0);
  const [sinceBreak, setSinceBreak] = useState(0);
  const [cycleUsed, setCycleUsed] = useState(0);
  const [fuelLevel, setFuelLevel] = useState(100);
  // Truck profile (defaults = standard 5-axle, 13'6" dry van at 80k GVW).
  const [heightFt, setHeightFt] = useState(13.5);
  const [lengthFt, setLengthFt] = useState(70);
  const [grossWeightLbs, setGrossWeightLbs] = useState(80000);
  const [axles, setAxles] = useState(5);
  const [hazmatClass, setHazmatClass] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<QuoteResponse | null>(null);

  const byId = useMemo(() => new Map(anchors.map((a) => [a.id, a])), [anchors]);
  const canSubmit = originId && destinationId && originId !== destinationId && !busy;

  const submit = async () => {
    const origin = byId.get(originId);
    const destination = byId.get(destinationId);
    if (!origin || !destination) return;
    setBusy(true);
    setResult(null);
    try {
      // Fall back to "now" when the field is empty OR unparseable — a NaN
      // here would fail schema validation server-side for no user benefit.
      const parsedDepart = departLocal ? new Date(departLocal).getTime() : NaN;
      const departAtMs = Number.isFinite(parsedDepart) ? parsedDepart : Date.now();
      const res = await fetch('/api/trip-planner/quote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: { label: origin.label, position: { lat: origin.lat, lng: origin.lng } },
          destination: {
            label: destination.label,
            position: { lat: destination.lat, lng: destination.lng },
          },
          departAtMs,
          clocks: {
            cycleRule: '70/8',
            drivingUsedMin: drivingUsed * 60,
            windowElapsedMin: windowUsed > 0 ? windowUsed * 60 : -1,
            drivingSinceBreakMin: Math.min(sinceBreak, drivingUsed) * 60,
            cycleUsedMin: Math.max(cycleUsed, drivingUsed) * 60,
          },
          fuelLevelFraction: fuelLevel / 100,
          truck: {
            heightFt,
            lengthFt,
            grossWeightLbs,
            axles,
            hazmatClass: hazmatClass || null,
          },
        }),
      });
      setResult((await res.json()) as QuoteResponse);
    } catch {
      setResult({ ok: false, error: { code: 'network', message: 'Could not reach the planner.' } });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      {/* ------------------------------------------------ inputs */}
      <label className={labelCls} htmlFor="tp-origin">
        Origin (directory location)
      </label>
      <select
        id="tp-origin"
        className={input}
        value={originId}
        onChange={(e) => setOriginId(e.target.value)}
      >
        <option value="">Choose a starting point…</option>
        {anchors.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </select>

      <label className={labelCls} htmlFor="tp-destination">
        Destination
      </label>
      <select
        id="tp-destination"
        className={input}
        value={destinationId}
        onChange={(e) => setDestinationId(e.target.value)}
      >
        <option value="">Choose a destination…</option>
        {anchors.map((a) => (
          <option key={a.id} value={a.id}>
            {a.label}
          </option>
        ))}
      </select>

      <label className={labelCls} htmlFor="tp-depart">
        Departure (blank = now)
      </label>
      <input
        id="tp-depart"
        type="datetime-local"
        className={input}
        value={departLocal}
        onChange={(e) => setDepartLocal(e.target.value)}
      />

      <fieldset className="mt-4 rounded-card border border-line p-4">
        <legend className="px-1 text-xs font-semibold uppercase tracking-wide text-muted">
          Your clocks right now (hours used)
        </legend>
        {(
          [
            ['Driving (of 11h)', drivingUsed, setDrivingUsed, 11],
            ['On-duty window (of 14h)', windowUsed, setWindowUsed, 14],
            ['Driving since last 30-min break (of 8h)', sinceBreak, setSinceBreak, 8],
            ['Cycle used (of 70h)', cycleUsed, setCycleUsed, 70],
          ] as [string, number, (v: number) => void, number][]
        ).map(([lbl, val, set, max]) => (
          <label key={lbl} className="mt-3 block text-sm text-ink first:mt-0">
            <span className="flex justify-between">
              <span>{lbl}</span>
              <span className="font-semibold text-signal">{val}h</span>
            </span>
            <input
              type="range"
              min={0}
              max={max}
              step={0.5}
              value={val}
              onChange={(e) => set(Number(e.target.value))}
              className="mt-1 w-full accent-signal"
            />
          </label>
        ))}
        <label className="mt-3 block text-sm text-ink">
          <span className="flex justify-between">
            <span>Fuel level</span>
            <span className="font-semibold text-signal">{fuelLevel}%</span>
          </span>
          <input
            type="range"
            min={5}
            max={100}
            step={5}
            value={fuelLevel}
            onChange={(e) => setFuelLevel(Number(e.target.value))}
            className="mt-1 w-full accent-signal"
          />
        </label>
      </fieldset>

      <details className="mt-4 rounded-card border border-line p-4">
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted">
          Truck profile (13&#39;6&quot; · 70 ft · 80,000 lb · 5 axles by default)
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <label className="block text-sm text-ink">
            Height (ft)
            <input
              type="number"
              min={8}
              max={15}
              step={0.1}
              value={heightFt}
              onChange={(e) => setHeightFt(Number(e.target.value))}
              className={input}
            />
          </label>
          <label className="block text-sm text-ink">
            Length (ft)
            <input
              type="number"
              min={20}
              max={120}
              step={1}
              value={lengthFt}
              onChange={(e) => setLengthFt(Number(e.target.value))}
              className={input}
            />
          </label>
          <label className="block text-sm text-ink">
            Gross weight (lb)
            <input
              type="number"
              min={10000}
              max={164000}
              step={1000}
              value={grossWeightLbs}
              onChange={(e) => setGrossWeightLbs(Number(e.target.value))}
              className={input}
            />
          </label>
          <label className="block text-sm text-ink">
            Axles
            <input
              type="number"
              min={2}
              max={9}
              step={1}
              value={axles}
              onChange={(e) => setAxles(Number(e.target.value))}
              className={input}
            />
          </label>
        </div>
        <label className="mt-3 block text-sm text-ink">
          Hazmat placard
          <select
            value={hazmatClass}
            onChange={(e) => setHazmatClass(e.target.value)}
            className={input}
          >
            {HAZMAT_OPTIONS.map(([v, lbl]) => (
              <option key={v} value={v}>
                {lbl}
              </option>
            ))}
          </select>
        </label>
      </details>

      <button
        type="button"
        disabled={!canSubmit}
        onClick={() => void submit()}
        className="mt-5 w-full rounded-card bg-signal px-5 py-4 font-display text-lg uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600 disabled:opacity-50"
      >
        {busy ? 'Planning…' : 'Plan my trip'}
      </button>
      {anchors.length === 0 && (
        <p className="mt-3 text-sm text-diesel">
          No geocoded directory locations available yet — check back soon.
        </p>
      )}

      {/* ------------------------------------------------ results */}
      {result && !result.ok && (
        <p
          role="alert"
          className="mt-6 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm font-medium text-diesel"
        >
          {result.error?.message}
          {result.error?.problems?.length ? ` — ${result.error.problems[0]}` : ''}
        </p>
      )}

      {result?.ok && result.routeSummary && result.itinerary && result.remainingAtDeparture && (
        <section className="mt-6 space-y-4">
          {/* Route summary */}
          <div className="rounded-card border border-line bg-asphalt-800 p-4">
            <h2 className="font-display text-lg uppercase text-ink">Route summary</h2>
            <p className="mt-1 text-2xl font-bold text-signal">
              {Math.round(result.routeSummary.miles)} mi
              <span className="ml-3 text-base font-semibold text-ink">
                ≈ {fmtHours(result.routeSummary.driveMinutes)} driving
              </span>
            </p>
            <p className="text-sm text-muted">
              Arrive ~
              <span className="font-semibold text-ink">{fmtTime(result.itinerary.arriveAtMs)}</span>{' '}
              · {fmtHours(result.itinerary.totalMinutes)} total (
              {fmtHours(result.itinerary.restMinutes)} rest)
            </p>
            {result.routeSummary.isEstimate ? (
              <p className="mt-1 text-xs text-muted">
                Distance is an estimate ({result.routeSummary.method}).
              </p>
            ) : (
              <p className="mt-1 text-xs text-muted">
                <span className="font-semibold text-signal">Truck-legal route</span> ·{' '}
                {result.routeSummary.method}
              </p>
            )}
            {result.routeSummary.instructions && result.routeSummary.instructions.length > 0 && (
              <details className="mt-2">
                <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted">
                  Turn-by-turn ({result.routeSummary.instructions.length} steps)
                </summary>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-xs text-muted">
                  {result.routeSummary.instructions.map((ins, i) => (
                    <li key={i}>{ins}</li>
                  ))}
                </ol>
              </details>
            )}
          </div>

          {/* Legal driving window */}
          <div className="rounded-card border border-line bg-asphalt-800 p-4">
            <h2 className="font-display text-lg uppercase text-ink">Legal driving window now</h2>
            <p className="mt-1 text-2xl font-bold text-signal">
              {fmtHours(result.remainingAtDeparture.legalDrivingMin)}
            </p>
            <p className="text-sm text-muted">
              Limited by the{' '}
              <span className="font-semibold text-ink">
                {result.remainingAtDeparture.limitedBy}
              </span>{' '}
              clock · 11h: {fmtHours(result.remainingAtDeparture.drivingMin)} left · 14h window:{' '}
              {fmtHours(result.remainingAtDeparture.windowMin)} left · break in:{' '}
              {fmtHours(result.remainingAtDeparture.untilBreakMin)} · cycle:{' '}
              {fmtHours(result.remainingAtDeparture.cycleMin)} left
            </p>
          </div>

          {/* Stops timeline */}
          <div className="rounded-card border border-line bg-asphalt-800 p-4">
            <h2 className="font-display text-lg uppercase text-ink">Recommended stops</h2>
            <ol className="mt-2 space-y-3">
              {result.itinerary.stops.map((s, i) => (
                <li key={i} className="border-b border-line pb-3 last:border-0 last:pb-0">
                  <p className="text-sm font-semibold text-ink">
                    {STOP_ICON[s.kind] ?? '📍'} {s.label}
                    <span className="ml-2 font-normal text-muted">
                      mile {Math.round(s.routeMile)}
                    </span>
                  </p>
                  <p className="text-xs text-muted">
                    {fmtTime(s.arriveAtMs)}
                    {s.dwellMinutes > 0 ? ` · ${fmtHours(s.dwellMinutes)} stop` : ''} · {s.reason}
                  </p>
                  {s.candidate && (
                    <p className="text-xs text-muted">
                      {s.candidate.parkingSpaces != null &&
                        `${s.candidate.parkingSpaces} spaces · `}
                      {s.candidate.amenities.slice(0, 4).join(' · ')}
                      {s.candidate.reservationUrl && (
                        <a
                          href={s.candidate.reservationUrl}
                          target="_blank"
                          rel="noreferrer sponsored"
                          className="ml-2 font-semibold text-signal hover:underline"
                        >
                          Reserve↗
                        </a>
                      )}
                    </p>
                  )}
                  {s.alternates.length > 0 && (
                    <p className="text-xs text-muted">
                      Alternates: {s.alternates.map((a) => a.name).join(', ')}
                    </p>
                  )}
                </li>
              ))}
            </ol>
            <p className="mt-2 text-xs text-muted">
              {result.candidatesAvailable} verified directory locations along this corridor.
            </p>
          </div>

          {/* Weather */}
          <div className="rounded-card border border-line bg-asphalt-800 p-4">
            <h2 className="font-display text-lg uppercase text-ink">Route weather</h2>
            {result.weather && result.weather.alerts.length > 0 && (
              <ul className="mt-1 space-y-1">
                {result.weather.alerts.map((a, i) => (
                  <li key={i} className="text-sm font-semibold text-diesel">
                    ⚠️ {a.headline}
                  </li>
                ))}
              </ul>
            )}
            {result.weather && result.weather.bands.length > 0 ? (
              <ul className="mt-1 space-y-1">
                {result.weather.bands.map((b, i) => (
                  <li key={i} className="text-sm text-muted">
                    mi {Math.round(b.fromMile)}–{Math.round(b.toMile)}:{' '}
                    <span
                      className={
                        b.severity === 'warning' ? 'font-semibold text-diesel' : 'text-ink'
                      }
                    >
                      {b.summary}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-1 text-sm text-muted">No weather data available for this route.</p>
            )}
          </div>

          {/* Fuel */}
          <div className="rounded-card border border-line bg-asphalt-800 p-4">
            <h2 className="font-display text-lg uppercase text-ink">Fuel estimate</h2>
            {result.cost?.fuelGallons != null && (
              <p className="mt-1 text-sm text-ink">≈ {result.cost.fuelGallons} gal for this trip</p>
            )}
            {result.fuelPrice ? (
              <p className="text-sm text-muted">
                Regional diesel ≈{' '}
                <span className="font-semibold text-signal">
                  ${(result.fuelPrice.centsPerGallon / 100).toFixed(2)}/gal
                </span>
                {result.cost?.fuelCents != null && (
                  <> · trip fuel ≈ ${(result.cost.fuelCents / 100).toFixed(0)}</>
                )}
                <span className="block text-xs">
                  {result.fuelPrice.source} · week of {result.fuelPrice.period}
                </span>
              </p>
            ) : (
              <p className="text-sm text-muted">Fuel price unavailable — no estimate shown.</p>
            )}
          </div>

          {/* Warnings + disclaimer */}
          {result.warnings && result.warnings.length > 0 && (
            <ul className="rounded-card border border-line bg-asphalt-800 p-4 text-xs text-muted">
              {result.warnings.map((w, i) => (
                <li key={i}>• {w}</li>
              ))}
            </ul>
          )}
          <p className="rounded-card border border-diesel/50 bg-diesel/5 p-4 text-xs text-muted">
            <span className="font-semibold text-diesel">HOS disclaimer:</span> {result.disclaimer}
          </p>
          {result.routingDisclaimer && (
            <p className="rounded-card border border-diesel/50 bg-diesel/5 p-4 text-xs text-muted">
              <span className="font-semibold text-diesel">Routing disclaimer:</span>{' '}
              {result.routingDisclaimer}
            </p>
          )}
        </section>
      )}
    </div>
  );
}
