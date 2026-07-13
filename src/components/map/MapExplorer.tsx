'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { detailHref } from '@/lib/directory/detail-slug';
import { DIRECTORY_CATEGORIES, getCategory } from '@/lib/directory/categories';
import { AMENITIES } from '@/lib/directory/amenities';
import { coordinateIssues } from '@/lib/map/geo';
import {
  applyExploreFilters,
  searchLocation,
  directionsUrl,
  hasActiveFilters,
  EMPTY_FILTERS,
  RADIUS_OPTIONS,
  PARKING_FILTERS,
  citiesIn,
  type ExploreFilters,
  type ExploreOrigin,
  type ExploreResult,
} from '@/lib/map/explore';
import type { DirectoryEntry } from '@/lib/directory/types';

/**
 * The /directory/map experience (Milestone 19). All interactivity lives here,
 * on this page only — the rest of the directory stays server-rendered. The
 * entry pool arrives server-filtered (published + non-deleted + valid
 * coordinates), filters run client-side over that small set, and "Use my
 * location" is strictly click-initiated: coordinates are read once, used for
 * the nearby lookup, kept only in component state, and never stored or
 * logged.
 */

const LeafletMap = dynamic(() => import('./LeafletMap').then((m) => m.LeafletMap), {
  ssr: false,
  loading: () => (
    <div className="flex h-[420px] w-full items-center justify-center rounded-card border border-line bg-asphalt-800 text-sm text-muted sm:h-[540px]">
      Loading map…
    </div>
  ),
});

const selectClasses =
  'rounded-card border border-line bg-asphalt px-3 py-2 text-sm text-ink ' +
  'focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal';
const chipClasses = (active: boolean) =>
  `rounded-card border px-3 py-1.5 text-xs font-semibold transition-colors focus:outline-none ` +
  `focus:ring-2 focus:ring-signal ${
    active ? 'border-signal bg-signal text-asphalt' : 'border-line bg-asphalt-800 text-ink hover:border-signal'
  }`;
const btnClasses =
  'rounded-card border border-line bg-asphalt-800 px-4 py-2 text-sm font-semibold text-ink ' +
  'transition-colors hover:border-signal hover:text-signal focus:outline-none focus:ring-2 focus:ring-signal disabled:opacity-60';

type NearbyApiListing = { id: string; distanceMiles: number };

export function MapExplorer({
  entries,
  states,
  interstates,
  stateNamesByCode,
}: {
  /** Server-filtered: published, non-deleted, valid coordinates only. */
  entries: DirectoryEntry[];
  states: string[];
  interstates: string[];
  stateNamesByCode: Record<string, string>;
}) {
  const [filters, setFilters] = useState<ExploreFilters>(EMPTY_FILTERS);
  const [origin, setOrigin] = useState<ExploreOrigin | null>(null);
  const [serverDistances, setServerDistances] = useState<Map<string, number> | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const [locating, setLocating] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [mapFailed, setMapFailed] = useState(false);
  const [fitKey, setFitKey] = useState(0);
  const [focus, setFocus] = useState<{ lat: number; lng: number } | null>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Detail pages deep-link one listing (?listing=<detail slug>): select it and
  // zoom to it once on load. Any later interaction releases the focus. Read
  // from window.location instead of useSearchParams so the explorer stays
  // fully prerenderable — useSearchParams bails the whole tree out of static
  // HTML, which stripped the map UI from ISR copies of /directory/map.
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get('listing');
    if (!slug) return;
    const entry = entries.find((e) => e.detailSlug === slug);
    if (entry && entry.lat != null && entry.lng != null) {
      setSelectedId(entry.id);
      setFocus({ lat: entry.lat, lng: entry.lng });
      setStatus(`Showing ${entry.name} — ${entry.city}, ${entry.state}.`);
    }
    // Run once for the initial URL only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cities = useMemo(() => citiesIn(entries), [entries]);
  const categoriesPresent = useMemo(() => {
    const present = new Set(entries.map((e) => e.category));
    return DIRECTORY_CATEGORIES.filter((c) => present.has(c.slug));
  }, [entries]);

  const results = useMemo(() => {
    const out = applyExploreFilters(entries, filters, origin);
    // Prefer server-computed distances (nearby RPC) when present.
    if (serverDistances) {
      for (const r of out) {
        const d = serverDistances.get(r.id);
        if (d != null) r.distanceMiles = d;
      }
    }
    return out;
  }, [entries, filters, origin, serverDistances]);

  // Refit the map when the visible set changes for filter/origin reasons.
  useEffect(() => {
    setFitKey((k) => k + 1);
  }, [filters, origin, entries]);

  // Screen-reader status: announce result-count changes.
  useEffect(() => {
    setStatus(
      `${results.length} location${results.length === 1 ? '' : 's'} shown` +
        (origin ? ` near ${origin.label}` : '') +
        (hasActiveFilters(filters) ? ' with filters applied' : ''),
    );
  }, [results.length, origin, filters]);

  function set<K extends keyof ExploreFilters>(key: K, value: ExploreFilters[K]) {
    setFocus(null);
    setFilters((f) => ({ ...f, [key]: value }));
  }
  function toggleAmenity(a: string) {
    setFilters((f) => ({
      ...f,
      amenities: f.amenities.includes(a)
        ? f.amenities.filter((x) => x !== a)
        : [...f.amenities, a],
    }));
  }
  function clearAll() {
    setFilters(EMPTY_FILTERS);
    setOrigin(null);
    setServerDistances(null);
    setSelectedId(null);
    setSearchText('');
    setFocus(null);
    setStatus('Filters cleared.');
  }

  /* ---------------------------------------------- use my location */
  async function useMyLocation() {
    if (!('geolocation' in navigator)) {
      setStatus('Location is not available in this browser — try the search box instead.');
      return;
    }
    setLocating(true);
    setFocus(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        if (coordinateIssues(lat, lng).length > 0) {
          setLocating(false);
          setStatus('Could not read a usable location — try the search box instead.');
          return;
        }
        setOrigin({ lat, lng, label: 'your location' });
        try {
          // The existing near-me foundation (RPC-backed, published-only,
          // capped). Coordinates go in a POST body — never a logged URL.
          const res = await fetch('/api/directory/nearby', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat, lng, radiusMiles: 250, limit: 100 }),
          });
          const body = await res.json();
          if (res.ok && body.ok) {
            setServerDistances(
              new Map(
                (body.data.listings as NearbyApiListing[]).map((l) => [l.id, l.distanceMiles]),
              ),
            );
          }
        } catch {
          // Local haversine distances still apply — nothing to do.
        }
        setLocating(false);
      },
      (err) => {
        setLocating(false);
        setStatus(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission was denied — no problem. Use the search box to center the map instead.'
            : 'Could not get your location — try the search box instead.',
        );
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  }

  /* ---------------------------------------------- manual search */
  function runSearch(ev: React.FormEvent) {
    ev.preventDefault();
    const result = searchLocation(entries, searchText, stateNamesByCode);
    if (result.kind === 'none') {
      setStatus(
        `No mapped listings match “${searchText.trim()}” yet — coverage is loading state by state. Try a nearby city or clear filters.`,
      );
      return;
    }
    setServerDistances(null);
    setFocus(null);
    setOrigin(result.origin);
    setStatus(`Centered on ${result.matches.length} listing${result.matches.length === 1 ? '' : 's'} matching “${searchText.trim()}”.`);
  }

  function selectFromCard(id: string) {
    setSelectedId(id);
  }
  function selectFromMarker(id: string) {
    setSelectedId(id);
    const el = listRef.current?.querySelector<HTMLElement>(`[data-entry-id="${id}"]`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  return (
    <div>
      {/* Toolbar */}
      <div className="grid gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={useMyLocation} disabled={locating} className={btnClasses}>
            {locating ? 'Locating…' : '📍 Use my location'}
          </button>
          <form onSubmit={runSearch} className="flex min-w-0 flex-1 items-center gap-2">
            <label htmlFor="map-search" className="sr-only">
              Search by city, state, ZIP, or business name
            </label>
            <input
              id="map-search"
              type="search"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="City, state, ZIP, or business…"
              className={`${selectClasses} w-full min-w-0 flex-1`}
            />
            <button type="submit" className={btnClasses}>
              Search
            </button>
          </form>
          {(hasActiveFilters(filters) || origin) && (
            <button type="button" onClick={clearAll} className={btnClasses}>
              Clear filters
            </button>
          )}
        </div>
        <p className="text-xs text-muted">
          Your location is used only to find nearby trucking resources and is not stored.
        </p>

        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="f-category" className="mb-1 block text-xs font-semibold text-muted">
              Category
            </label>
            <select
              id="f-category"
              value={filters.category}
              onChange={(e) => set('category', e.target.value)}
              className={selectClasses}
            >
              <option value="">All categories</option>
              {categoriesPresent.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-state" className="mb-1 block text-xs font-semibold text-muted">
              State
            </label>
            <select
              id="f-state"
              value={filters.state}
              onChange={(e) => set('state', e.target.value)}
              className={selectClasses}
            >
              <option value="">All states</option>
              {states.map((s) => (
                <option key={s} value={s}>
                  {stateNamesByCode[s] ?? s}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-interstate" className="mb-1 block text-xs font-semibold text-muted">
              Interstate
            </label>
            <select
              id="f-interstate"
              value={filters.interstate}
              onChange={(e) => set('interstate', e.target.value)}
              className={selectClasses}
            >
              <option value="">All interstates</option>
              {interstates.map((i) => (
                <option key={i} value={i}>
                  {i}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-city" className="mb-1 block text-xs font-semibold text-muted">
              City
            </label>
            <select
              id="f-city"
              value={filters.city}
              onChange={(e) => set('city', e.target.value)}
              className={selectClasses}
            >
              <option value="">All cities</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="f-radius" className="mb-1 block text-xs font-semibold text-muted">
              Radius {origin ? '' : '(set a location first)'}
            </label>
            <select
              id="f-radius"
              value={filters.radiusMiles}
              onChange={(e) => set('radiusMiles', Number(e.target.value))}
              disabled={!origin}
              className={selectClasses}
            >
              <option value={0}>Any distance</option>
              {RADIUS_OPTIONS.map((r) => (
                <option key={r} value={r}>
                  Within {r} miles
                </option>
              ))}
            </select>
          </div>
        </div>

        <fieldset>
          <legend className="mb-1.5 text-xs font-semibold text-muted">Parking &amp; amenities</legend>
          <div className="flex flex-wrap gap-2">
            {PARKING_FILTERS.map((p) => (
              <button
                key={p.key}
                type="button"
                aria-pressed={filters.amenities.includes(p.key)}
                onClick={() => toggleAmenity(p.key)}
                className={chipClasses(filters.amenities.includes(p.key))}
              >
                {p.label}
              </button>
            ))}
            {AMENITIES.map((a) => (
              <button
                key={a}
                type="button"
                aria-pressed={filters.amenities.includes(a)}
                onClick={() => toggleAmenity(a)}
                className={chipClasses(filters.amenities.includes(a))}
              >
                {a}
              </button>
            ))}
          </div>
        </fieldset>
      </div>

      {/* Screen-reader + visible status */}
      <p role="status" aria-live="polite" className="mt-4 text-sm font-semibold text-signal">
        {status || `${results.length} location${results.length === 1 ? '' : 's'} shown`}
      </p>

      {/* Map */}
      <div className="mt-3">
        {mapFailed ? (
          <div className="flex h-40 items-center justify-center rounded-card border border-diesel bg-diesel/10 px-4 text-sm text-diesel-300">
            The map failed to load. Every result is still available in the list below.
          </div>
        ) : (
          <LeafletMap
            results={results}
            selectedId={selectedId}
            onSelect={selectFromMarker}
            origin={origin}
            fitKey={fitKey}
            focus={focus}
            onError={() => setMapFailed(true)}
          />
        )}
      </div>

      {/* Results list */}
      <h2 className="mt-8 font-display text-2xl uppercase text-ink">
        {results.length} location{results.length === 1 ? '' : 's'}
        {origin ? <span className="text-muted"> · nearest first</span> : null}
      </h2>
      {results.length === 0 ? (
        <div className="mt-4 rounded-card border border-line bg-asphalt-800 p-8 text-center">
          <p className="font-semibold text-ink">No mapped locations match these filters.</p>
          <p className="mt-2 text-sm text-muted">
            Coordinates are loading batch by batch — the rest of the directory is still browsable
            by list. Try widening the radius or clearing filters.
          </p>
          <button type="button" onClick={clearAll} className={`${btnClasses} mt-4`}>
            Clear filters
          </button>
        </div>
      ) : (
        <ul ref={listRef} className="mt-4 grid gap-4 sm:grid-cols-2" aria-label="Map results">
          {results.map((e) => (
            <MapResultCard
              key={e.id}
              entry={e}
              selected={e.id === selectedId}
              onSelect={() => selectFromCard(e.id)}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function MapResultCard({
  entry,
  selected,
  onSelect,
}: {
  entry: ExploreResult;
  selected: boolean;
  onSelect: () => void;
}) {
  const cat = getCategory(entry.category);
  const dir = directionsUrl(entry);
  return (
    <li data-entry-id={entry.id}>
      <div
        className={`h-full rounded-card border bg-asphalt-800 p-5 transition-colors ${
          selected ? 'border-signal ring-2 ring-signal' : 'border-line'
        }`}
      >
        <button
          type="button"
          onClick={onSelect}
          aria-pressed={selected}
          className="block w-full text-left focus:outline-none focus:ring-2 focus:ring-signal"
        >
          <div className="flex items-start justify-between gap-2">
            <span className="font-display text-lg uppercase text-ink">{entry.name}</span>
            {entry.distanceMiles != null && (
              <span className="shrink-0 rounded-card bg-signal px-2 py-0.5 text-xs font-bold text-asphalt">
                {entry.distanceMiles} mi
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            {cat ? `${cat.icon} ${cat.title}` : entry.category} · {entry.city}, {entry.state}
            {entry.interstate ? ` · ${entry.interstate}` : ''}
            {entry.exitNumber ? ` Exit ${entry.exitNumber}` : ''}
          </p>
          {entry.address && <p className="mt-1 text-sm text-muted">{entry.address}</p>}
          {entry.amenities && entry.amenities.length > 0 && (
            <p className="mt-2 text-xs text-muted">{entry.amenities.join(' · ')}</p>
          )}
        </button>
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          {entry.detailSlug && (
            <Link
              href={detailHref(entry.detailSlug)}
              className="font-semibold text-signal hover:underline"
              aria-label={`View details for ${entry.name}`}
            >
              View details
            </Link>
          )}
          {entry.phone && (
            <a href={`tel:${entry.phone}`} className="font-semibold text-signal hover:underline">
              {entry.phone}
            </a>
          )}
          {entry.website && (
            <a
              href={entry.website}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-signal hover:underline"
            >
              Website
            </a>
          )}
          {dir && (
            <a
              href={dir}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Get directions to ${entry.name} (opens in new tab)`}
              className="font-semibold text-signal hover:underline"
            >
              Get directions
            </a>
          )}
          {entry.tpcUrl && (
            <a
              href={entry.tpcUrl}
              target="_blank"
              rel="sponsored noopener noreferrer"
              className="rounded-card bg-signal px-3 py-1 text-xs font-bold uppercase text-asphalt hover:bg-signal-600"
            >
              Reserve a spot
            </a>
          )}
        </div>
      </div>
    </li>
  );
}
