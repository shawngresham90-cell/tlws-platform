'use client';

import { useMemo, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import type { ListingRef } from '@/lib/community/data';

/**
 * Dependency-free searchable picker over the published listings. Type to
 * filter by name / city / state; click a result to select it. The selected id
 * is what the API validates against (must be a live published listing).
 *
 * The pool it filters is now COMPLETE — every published listing, not the
 * first 2,000 (DIR-COMPLETE-2). At most MAX_RESULTS rows are ever rendered,
 * so a complete pool costs nothing in the DOM; the filter runs over the whole
 * array and stops at the render cap.
 *
 * `unavailable` exists because the two failure modes read identically to a
 * driver otherwise. An empty pool because the directory genuinely has no
 * listings, and an empty pool because the read failed, both used to render
 * "No published listing matches…" — telling a driver their truck stop is not
 * in the directory when the truth was that we could not look.
 */

const MAX_RESULTS = 12;

function labelFor(l: ListingRef): string {
  return `${l.name} — ${l.city}, ${l.state}`;
}

/** The field label, as a <label> when there is a control to label. */
function Label({
  as,
  id,
  htmlFor,
  children,
}: {
  as: 'label' | 'p';
  id: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  const className = 'mb-1.5 block text-sm font-semibold text-ink';
  return as === 'label' ? (
    <label id={id} htmlFor={htmlFor} className={className}>
      {children}
    </label>
  ) : (
    <p id={id} className={className}>
      {children}
    </p>
  );
}

export function LocationPicker({
  id,
  label,
  required,
  listings,
  value,
  onChange,
  error,
  unavailable,
  unavailableAction,
}: {
  id: string;
  label: string;
  required?: boolean;
  listings: ListingRef[];
  /** Selected listing id ('' = none). */
  value: string;
  onChange: (id: string) => void;
  error?: string;
  /** The listing read FAILED — not the same thing as an empty directory. */
  unavailable?: boolean;
  /** What this particular form lets the driver do instead. */
  unavailableAction?: string;
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
      {/* With no input to point at, `htmlFor` would reference a missing id;
          the text becomes the status region's accessible name instead. */}
      <Label
        as={unavailable ? 'p' : 'label'}
        id={`${id}-label`}
        htmlFor={unavailable ? undefined : id}
      >
        {label}
        {required && (
          <span className="text-diesel-300" aria-hidden="true">
            {' '}
            *
          </span>
        )}
      </Label>

      {unavailable ? (
        <p
          id={`${id}-unavailable`}
          role="status"
          aria-labelledby={`${id}-label`}
          className="rounded-card border border-line bg-asphalt-800 px-4 py-3 text-sm text-muted"
        >
          Listing search is temporarily unavailable — we couldn’t reach the directory just now.
          Reload the page in a minute to try again.
          {unavailableAction ? ` ${unavailableAction}` : ''}
        </p>
      ) : selected ? (
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

      {/* "Pick the listing" is not actionable advice while there is nothing to
          pick from — the status message above already says why. */}
      {error && !unavailable && (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm font-medium text-diesel-300">
          {error}
        </p>
      )}
    </div>
  );
}
