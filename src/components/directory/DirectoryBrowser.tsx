'use client';

import { useMemo, useState } from 'react';
import type { DirectoryEntry } from '@/lib/directory/types';
import { EntryCard } from './EntryCard';
import { DirectoryEmptyState } from './DirectoryEmptyState';

/**
 * The interactive half of every directory page: search box + state and city
 * filters over whatever entries the (currently static) data layer provides.
 * Purely client-side filtering — when the database lands this component keeps
 * working unchanged; only the data source behind the page swaps.
 */
const inputClasses =
  'w-full rounded-card border border-line bg-asphalt-800 px-4 py-3 text-ink placeholder:text-muted/60 ' +
  'focus:border-signal focus:outline-none';

export function DirectoryBrowser({
  categoryTitle,
  entries,
}: {
  categoryTitle: string;
  entries: DirectoryEntry[];
}) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');

  const stateOptions = useMemo(() => [...new Set(entries.map((e) => e.state))].sort(), [entries]);
  const cityOptions = useMemo(
    () =>
      [...new Set(entries.filter((e) => !state || e.state === state).map((e) => e.city))].sort(),
    [entries, state],
  );

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return entries.filter((e) => {
      if (state && e.state !== state) return false;
      if (city && e.city !== city) return false;
      if (!q) return true;
      const haystack = `${e.name} ${e.city} ${e.state} ${e.description ?? ''}`.toLowerCase();
      return haystack.includes(q);
    });
  }, [entries, query, state, city]);

  const hasFilters = Boolean(query.trim() || state || city);

  function clearFilters() {
    setQuery('');
    setState('');
    setCity('');
  }

  return (
    <div>
      {/* Search + filters — stacks on mobile, one row on desktop */}
      <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div>
          <label htmlFor="directory-search" className="sr-only">
            Search {categoryTitle}
          </label>
          <input
            id="directory-search"
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Search ${categoryTitle.toLowerCase()}…`}
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
            }}
            disabled={stateOptions.length === 0}
            className={`${inputClasses} sm:w-44 disabled:opacity-50`}
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
            onChange={(e) => setCity(e.target.value)}
            disabled={cityOptions.length === 0}
            className={`${inputClasses} sm:w-44 disabled:opacity-50`}
          >
            <option value="">All cities</option>
            {cityOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Result count (screen-reader announced) */}
      <p aria-live="polite" className="mt-4 text-sm text-muted">
        {entries.length === 0
          ? 'No locations loaded yet.'
          : `${results.length} of ${entries.length} location${entries.length === 1 ? '' : 's'}`}
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
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {results.map((e) => (
              <EntryCard key={e.id} entry={e} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
