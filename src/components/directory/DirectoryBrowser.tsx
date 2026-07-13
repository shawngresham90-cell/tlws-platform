'use client';

import { useDeferredValue, useMemo, useState } from 'react';
import type { DirectoryEntry } from '@/lib/directory/types';
import { filterAndSortEntries, type SortKey } from '@/lib/directory/browse';
import { EntryCard } from './EntryCard';
import { DirectoryEmptyState } from './DirectoryEmptyState';

/**
 * The interactive half of every directory page: search (name, city, state,
 * ZIP, interstate), state/city filters, sorting (featured / A–Z / newest /
 * distance via browser geolocation), and lazy "load more" rendering so a
 * thousand-listing category doesn't paint a thousand cards up front. The
 * filter/sort logic lives in lib/directory/browse.ts (pure, tested).
 */
const inputClasses =
  'w-full rounded-card border border-line bg-asphalt-800 px-4 py-3 text-ink placeholder:text-muted/60 ' +
  'focus:border-signal focus:outline-none focus:ring-2 focus:ring-signal focus:ring-offset-2 focus:ring-offset-asphalt';

const PAGE = 30;

export function DirectoryBrowser({
  categoryTitle,
  entries,
  cardHeadingLevel = 'h3',
}: {
  categoryTitle: string;
  entries: DirectoryEntry[];
  /** 'h2' when the browser sits directly under the page h1 (heading hierarchy). */
  cardHeadingLevel?: 'h2' | 'h3';
}) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [sort, setSort] = useState<SortKey>('featured');
  const [visible, setVisible] = useState(PAGE);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'asking' | 'denied'>('idle');

  const stateOptions = useMemo(() => [...new Set(entries.map((e) => e.state))].sort(), [entries]);
  const cityOptions = useMemo(
    () =>
      [...new Set(entries.filter((e) => !state || e.state === state).map((e) => e.city))].sort(),
    [entries, state],
  );

  // Defer the query so fast typing never blocks the input — the fuzzy
  // scorer re-ranks up to ~1,000 entries per keystroke (perf audit).
  const deferredQuery = useDeferredValue(query);
  const results = useMemo(
    () => filterAndSortEntries(entries, { query: deferredQuery, state, city, sort, origin }),
    [entries, deferredQuery, state, city, sort, origin],
  );
  const shown = results.slice(0, visible);

  const hasFilters = Boolean(query.trim() || state || city);

  function clearFilters() {
    setQuery('');
    setState('');
    setCity('');
    setVisible(PAGE);
  }

  function chooseSort(next: SortKey) {
    setSort(next);
    setVisible(PAGE);
    if (next === 'distance' && !origin && typeof navigator !== 'undefined') {
      if (!navigator.geolocation) {
        setGeoStatus('denied');
        return;
      }
      setGeoStatus('asking');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGeoStatus('idle');
        },
        () => setGeoStatus('denied'),
        { maximumAge: 300_000, timeout: 10_000 },
      );
    }
  }

  return (
    <div>
      {/* Search + filters + sort — stacks on mobile, one row on desktop */}
      <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
        <div>
          <label htmlFor="directory-search" className="sr-only">
            Search {categoryTitle}
          </label>
          <input
            id="directory-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisible(PAGE);
            }}
            placeholder={`Search brand, city, exit, interstate (I-40, exit 81)…`}
            className={inputClasses}
          />
        </div>
        <div>
          <label htmlFor="directory-state" className="sr-only">
            Filter by state
          </label>
          <select
            id="directory-state"
            value={state}
            onChange={(e) => {
              setState(e.target.value);
              setCity('');
              setVisible(PAGE);
            }}
            disabled={stateOptions.length === 0}
            className={`${inputClasses} lg:w-40 disabled:opacity-50`}
          >
            <option value="">All states</option>
            {stateOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="directory-city" className="sr-only">
            Filter by city
          </label>
          <select
            id="directory-city"
            value={city}
            onChange={(e) => {
              setCity(e.target.value);
              setVisible(PAGE);
            }}
            disabled={cityOptions.length === 0}
            className={`${inputClasses} lg:w-40 disabled:opacity-50`}
          >
            <option value="">All cities</option>
            {cityOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="directory-sort" className="sr-only">
            Sort
          </label>
          <select
            id="directory-sort"
            value={sort}
            onChange={(e) => chooseSort(e.target.value as SortKey)}
            className={`${inputClasses} lg:w-44`}
          >
            <option value="featured">Featured first</option>
            <option value="alpha">A–Z</option>
            <option value="newest">Newest</option>
            <option value="distance">Nearest to me</option>
          </select>
        </div>
      </div>

      {/* Result count + geolocation status (screen-reader announced) */}
      <p aria-live="polite" className="mt-4 text-sm text-muted">
        {entries.length === 0
          ? 'No locations loaded yet.'
          : `${results.length} of ${entries.length} location${entries.length === 1 ? '' : 's'}`}
        {sort === 'distance' && geoStatus === 'asking' && ' · finding your location…'}
        {sort === 'distance' && geoStatus === 'denied' && ' · location unavailable — sorted A–Z'}
        {sort === 'distance' && origin && ' · sorted by distance from you'}
      </p>

      {/* Results / empty states */}
      <div className="mt-4">
        {entries.length === 0 ? (
          <DirectoryEmptyState variant="building" categoryTitle={categoryTitle} />
        ) : results.length === 0 ? (
          <DirectoryEmptyState
            variant="no-results"
            categoryTitle={categoryTitle}
            onClear={hasFilters ? clearFilters : undefined}
          />
        ) : (
          <>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((e) => (
                <EntryCard key={e.id} entry={e} headingLevel={cardHeadingLevel} />
              ))}
            </div>
            {results.length > visible && (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => setVisible((v) => v + PAGE)}
                  className="rounded-card border border-line px-6 py-3 font-display text-lg uppercase tracking-wide text-ink transition-colors hover:border-signal hover:text-signal"
                >
                  Load more ({results.length - visible} left)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
