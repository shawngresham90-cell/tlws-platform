'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { ListingRef } from '@/lib/community/data';

/**
 * Dependency-free searchable picker over the published listings. Type to
 * filter by name / city / state; click a result to select it. The selected id
 * is what the API validates against (must be a live published listing).
 */

const MAX_RESULTS = 12;

function labelFor(l: ListingRef): string {
  return `${l.name} — ${l.city}, ${l.state}`;
}

export function LocationPicker({
  id,
  label,
  required,
  listings,
  value,
  onChange,
  error,
}: {
  id: string;
  label: string;
  required?: boolean;
  listings: ListingRef[];
  /** Selected listing id ('' = none). */
  value: string;
  onChange: (id: string) => void;
  error?: string;
}) {
  const [query, setQuery] = useState('');
  const selected = useMemo(() => listings.find((l) => l.id === value), [listings, value]);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return listings
      .filter((l) => `${l.name} ${l.city} ${l.state}`.toLowerCase().includes(q))
      .slice(0, MAX_RESULTS);
  }, [listings, query]);

  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-ink">
        {label}
        {required && (
          <span className="text-diesel-300" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </label>

      {selected ? (
        <div className="flex items-center justify-between gap-3 rounded-card border border-signal bg-asphalt-800 px-4 py-3">
          <span className="text-sm font-semibold text-ink">{labelFor(selected)}</span>
          <button
            type="button"
            onClick={() => {
              onChange('');
              setQuery('');
            }}
            className="shrink-0 text-sm font-semibold text-muted underline hover:text-signal"
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            id={id}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, city, or state…"
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            className={cn(
              'w-full rounded-card border bg-asphalt-800 px-4 py-3 text-ink placeholder:text-muted/60',
              'focus:outline-none focus:ring-2 focus:ring-signal focus:ring-offset-2 focus:ring-offset-asphalt',
              error ? 'border-diesel' : 'border-line',
            )}
          />
          {query.trim() && (
            <ul className="mt-2 overflow-hidden rounded-card border border-line" role="listbox">
              {matches.length === 0 && (
                <li className="bg-asphalt-800 px-4 py-3 text-sm text-muted">
                  No published listing matches “{query.trim()}”. If it isn’t in the directory yet,
                  submit it as a new location instead.
                </li>
              )}
              {matches.map((l) => (
                <li key={l.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={false}
                    onClick={() => onChange(l.id)}
                    className="w-full border-b border-line bg-asphalt-800 px-4 py-2.5 text-left text-sm text-ink transition-colors last:border-b-0 hover:bg-asphalt hover:text-signal"
                  >
                    {labelFor(l)}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {error && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm font-medium text-diesel-300">
          {error}
        </p>
      )}
    </div>
  );
}
