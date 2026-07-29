'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import type { DirectoryEntry } from '@/lib/directory/types';
import { withDistance, sortByDistance, withinRadius } from '@/lib/map/geo';
import { searchLocation, directionsUrl, type ExploreOrigin } from '@/lib/map/explore';

/**
 * CAT Scale "Near Me" — synchronized map and list.
 *
 * Privacy contract (release-blocking, statically tested):
 * - Geolocation is requested ONLY inside the "Use my location" click
 *   handler. Permission denial falls back to the manual city/ZIP box.
 * - The coordinates live in component state for this page view only. They
 *   are never written to localStorage/sessionStorage/cookies/IndexedDB,
 *   never sent to any endpoint, and never logged.
 * - Distances are haversine straight-line miles and are labeled
 *   "approximate straight-line distance" — never presented as road miles.
 */

const LeafletMap = dynamic(() => import('@/components/map/LeafletMap').then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[360px] w-full items-center justify-center rounded-card border border-line bg-asphalt-800 text-sm text-muted sm:h-[440px]">
      Loading map…
    </div>
  ),
});

const RADII = [20, 50, 100] as const;
type Radius = (typeof RADII)[number] | 'all';

export function CatScaleNearMe({
  scales,
  searchPool,
  stateNames,
}: {
  /** Published CAT Scale listings with verified coordinates. */
  scales: DirectoryEntry[];
  /** Published coordinate-ready listings (all categories) — resolves manual city/ZIP input to a real area, never invented coordinates. */
  searchPool: DirectoryEntry[];
  stateNames: Record<string, string>;
}) {
  const [origin, setOrigin] = useState<ExploreOrigin | null>(null);
  const [radius, setRadius] = useState<Radius>(50);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState<
    | { kind: 'idle' }
    | { kind: 'locating' }
    | { kind: 'denied' }
    | { kind: 'unavailable' }
    | { kind: 'no-match'; query: string }
    | { kind: 'ok' }
  >({ kind: 'idle' });
  const [query, setQuery] = useState('');
  const [fitKey, setFitKey] = useState(0);
  const [mapError, setMapError] = useState(false);

  function useMyLocation() {
    if (!('geolocation' in navigator)) {
      setStatus({ kind: 'unavailable' });
      return;
    }
    setStatus({ kind: 'locating' });
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Read once, keep in state only — never stored, tracked, or logged.
        setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'Your location' });
        setStatus({ kind: 'ok' });
        setFitKey((k) => k + 1);
      },
      () => setStatus({ kind: 'denied' }),
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 0 },
    );
  }

  function submitManual(e: React.FormEvent) {
    e.preventDefault();
    const result = searchLocation(searchPool, query, stateNames);
    if (result.kind === 'match') {
      setOrigin(result.origin);
      setStatus({ kind: 'ok' });
      setFitKey((k) => k + 1);
    } else {
      setStatus({ kind: 'no-match', query });
    }
  }

  const results = useMemo(() => {
    if (!origin) return [];
    const measured = sortByDistance(withDistance(scales, origin));
    return radius === 'all' ? measured : withinRadius(measured, radius);
  }, [origin, radius, scales]);

  return (
    <div>
      {/* Step 1 — choose how to set the search origin. */}
      <div className="grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={useMyLocation}
          className="inline-flex min-h-[56px] items-center justify-center gap-2 rounded-card bg-signal px-4 font-display text-lg uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt"
        >
          <span aria-hidden="true">📍</span>
          {status.kind === 'locating' ? 'Locating…' : 'Use my location'}
        </button>
        <form onSubmit={submitManual} className="flex gap-2">
          <label className="sr-only" htmlFor="near-me-query">
            City, state, or ZIP
          </label>
          <input
            id="near-me-query"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="City, ST or ZIP"
            className="min-h-[56px] w-full rounded-card border border-line bg-asphalt px-3 text-ink placeholder:text-muted focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal"
          />
          <button
            type="submit"
            className="inline-flex min-h-[56px] items-center justify-center rounded-card border border-ink/60 px-4 font-display uppercase tracking-wide text-ink transition-colors hover:border-signal hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
          >
            Go
          </button>
        </form>
      </div>
      {status.kind === 'denied' ? (
        <p role="status" className="placard mt-3 p-3 text-sm text-muted">
          Location permission was denied — no problem. Type a city or ZIP above instead. Nothing
          about your location is stored either way.
        </p>
      ) : null}
      {status.kind === 'unavailable' ? (
        <p role="status" className="placard mt-3 p-3 text-sm text-muted">
          This browser doesn&rsquo;t offer location. Type a city or ZIP above instead.
        </p>
      ) : null}
      {status.kind === 'no-match' ? (
        <p role="status" className="placard mt-3 p-3 text-sm text-muted">
          Couldn&rsquo;t place &ldquo;{status.query}&rdquo; from the directory&rsquo;s published
          listings. Try &ldquo;City, ST&rdquo; or a nearby larger town — we never guess coordinates.
        </p>
      ) : null}

      {/* Step 2 — radius filter. */}
      {origin ? (
        <>
          <fieldset className="mt-5">
            <legend className="doc-caption mb-2 uppercase tracking-widest text-muted">
              Within
            </legend>
            <div className="flex flex-wrap gap-2">
              {[...RADII, 'all' as const].map((r) => (
                <button
                  key={String(r)}
                  type="button"
                  onClick={() => {
                    setRadius(r);
                    setFitKey((k) => k + 1);
                  }}
                  aria-pressed={radius === r}
                  className={`min-h-[48px] rounded-card border px-4 font-display uppercase tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal ${
                    radius === r
                      ? 'border-signal bg-signal text-asphalt'
                      : 'border-line text-ink hover:border-signal'
                  }`}
                >
                  {r === 'all' ? 'All' : `${r} mi`}
                </button>
              ))}
            </div>
          </fieldset>
          <p className="doc-caption mt-3 text-muted" role="status" aria-live="polite">
            {results.length} scale{results.length === 1 ? '' : 's'}
            {radius === 'all' ? '' : ` within ${radius} miles`} of {origin.label}. Distances are
            approximate straight-line distance, not road miles.
          </p>

          {/* Map + accessible list, synchronized by selection. */}
          {!mapError ? (
            <div className="mt-4">
              <LeafletMap
                results={results}
                selectedId={selectedId}
                onSelect={setSelectedId}
                origin={origin}
                fitKey={fitKey}
                onError={() => setMapError(true)}
              />
            </div>
          ) : (
            <p className="placard mt-4 p-3 text-sm text-muted">
              The map couldn&rsquo;t load here — the list below has everything.
            </p>
          )}

          <ul aria-label="Nearest CAT Scales" className="mt-4 list-none space-y-3 p-0">
            {results.map((s) => (
              <li
                key={s.id}
                className={`placard p-4 ${selectedId === s.id ? 'border-signal' : ''}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-display text-lg uppercase leading-snug text-ink">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedId(s.id);
                        }}
                        className="text-left hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                      >
                        {s.name}
                      </button>
                    </h3>
                    <p className="mt-1 text-sm text-muted">
                      {s.city}, {s.state}
                      {s.phone ? (
                        <>
                          {' · '}
                          <a
                            className="text-signal underline-offset-4 hover:underline"
                            href={`tel:${s.phone.replace(/[^+\d]/g, '')}`}
                          >
                            {s.phone}
                          </a>
                        </>
                      ) : null}
                    </p>
                  </div>
                  {typeof s.distanceMiles === 'number' ? (
                    <div className="shrink-0 text-right">
                      <div className="font-display text-2xl leading-none text-signal">
                        {s.distanceMiles < 10
                          ? s.distanceMiles.toFixed(1)
                          : Math.round(s.distanceMiles)}
                      </div>
                      <div className="doc-caption text-muted">mi approx.</div>
                    </div>
                  ) : null}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {directionsUrl(s) ? (
                    <a
                      href={directionsUrl(s)!}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-[48px] items-center justify-center rounded-card bg-signal px-4 font-display uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt"
                    >
                      Directions
                      <span className="sr-only"> to {s.name} (opens in new tab)</span>
                    </a>
                  ) : (
                    <span className="inline-flex min-h-[48px] items-center justify-center rounded-card border border-line px-4 font-display uppercase tracking-wide text-muted">
                      No directions
                    </span>
                  )}
                  {s.detailSlug ? (
                    <Link
                      href={`/directory/location/${s.detailSlug}`}
                      className="inline-flex min-h-[48px] items-center justify-center rounded-card border border-ink/60 px-4 font-display uppercase tracking-wide text-ink transition-colors hover:border-signal hover:text-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
                    >
                      Details
                    </Link>
                  ) : (
                    <span className="inline-flex min-h-[48px] items-center justify-center rounded-card border border-line px-4 font-display uppercase tracking-wide text-muted">
                      No detail page
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {results.length === 0 ? (
            <p className="placard mt-4 p-4 text-sm text-muted">
              No published scale with verified coordinates
              {radius === 'all' ? '' : ` within ${radius} miles`}. Try a wider radius, or browse{' '}
              <Link
                className="text-signal underline underline-offset-4"
                href="/directory/cat-scales"
              >
                by state and interstate
              </Link>
              .
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
