'use client';

import { useMemo, useState } from 'react';
import type { DirectoryEntry } from '@/lib/directory/types';
import { filterAndSortEntries } from '@/lib/directory/browse';
import { DIRECTORY_CATEGORIES, getCategory } from '@/lib/directory/categories';
import { stateByCode } from '@/lib/directory/states';
import { EntryCard } from './EntryCard';
import { DirectoryEmptyState } from './DirectoryEmptyState';

/**
 * The interactive body of the state / interstate / exit pages: one search box
 * (name, brand, city, state, ZIP, exit, interstate, amenities, category),
 * category filter chips with live counts, an automatic Featured section, and
 * results grouped by category (state pages) or by state (corridor pages).
 * Pure display over data the server already fetched — no client fetching.
 */

const inputClasses =
  'w-full rounded-card border border-line bg-asphalt-800 px-4 py-3 text-ink placeholder:text-muted/60 ' +
  'focus:border-signal focus:outline-none';

const SECTION_PREVIEW = 12;

type GroupBy = 'category' | 'state';

function groupKey(e: DirectoryEntry, groupBy: GroupBy): string {
  return groupBy === 'category' ? e.category : e.state;
}

function groupLabel(key: string, groupBy: GroupBy): string {
  if (groupBy === 'category') return getCategory(key)?.title ?? key;
  return stateByCode(key)?.name ?? key;
}

function Section({
  label,
  entries,
  headingId,
}: {
  label: string;
  entries: DirectoryEntry[];
  headingId: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? entries : entries.slice(0, SECTION_PREVIEW);
  return (
    <section aria-labelledby={headingId} className="mt-10 first:mt-6">
      <div className="flex items-baseline justify-between gap-4">
        <h2 id={headingId} className="font-display text-2xl uppercase text-ink">
          {label} <span className="text-base text-muted">({entries.length})</span>
        </h2>
      </div>
      <div className="mt-4 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((e) => (
          <EntryCard key={e.id} entry={e} />
        ))}
      </div>
      {entries.length > SECTION_PREVIEW && (
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="rounded-card border border-line px-5 py-2.5 font-display text-base uppercase tracking-wide text-ink transition-colors hover:border-signal hover:text-signal"
          >
            {expanded ? 'Show fewer' : `Show all ${entries.length}`}
          </button>
        </div>
      )}
    </section>
  );
}

export function MultiCategoryBrowser({
  entries,
  scopeLabel,
  groupBy = 'category',
  stateOrder = [],
}: {
  entries: DirectoryEntry[];
  /** Human label for the scope, e.g. "Georgia" or "I-75" — a11y + empty states. */
  scopeLabel: string;
  groupBy?: GroupBy;
  /** For groupBy="state": geographic order of state codes along the corridor. */
  stateOrder?: string[];
}) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('');

  // Chip counts come from the full entry set so chips don't vanish mid-search.
  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of entries) counts.set(e.category, (counts.get(e.category) ?? 0) + 1);
    return counts;
  }, [entries]);
  const chipCategories = DIRECTORY_CATEGORIES.filter((c) => (categoryCounts.get(c.slug) ?? 0) > 0);

  const results = useMemo(() => {
    const searched = filterAndSortEntries(entries, {
      query,
      state: '',
      city: '',
      sort: 'featured',
    });
    return activeCategory ? searched.filter((e) => e.category === activeCategory) : searched;
  }, [entries, query, activeCategory]);

  const featured = results.filter((e) => e.featured);

  const groups = useMemo(() => {
    const map = new Map<string, DirectoryEntry[]>();
    for (const e of results) {
      const key = groupKey(e, groupBy);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }
    const order = (key: string): number => {
      if (groupBy === 'category') {
        const i = DIRECTORY_CATEGORIES.findIndex((c) => c.slug === key);
        return i === -1 ? 999 : i;
      }
      const i = stateOrder.indexOf(key);
      return i === -1 ? 999 : i;
    };
    return [...map.entries()].sort(
      (a, b) => order(a[0]) - order(b[0]) || a[0].localeCompare(b[0]),
    );
  }, [results, groupBy, stateOrder]);

  const hasFilters = Boolean(query.trim() || activeCategory);

  return (
    <div>
      <div>
        <label htmlFor="scope-search" className="sr-only">
          Search {scopeLabel} listings
        </label>
        <input
          id="scope-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, brand, city, ZIP, exit, amenity, category…"
          className={inputClasses}
        />
      </div>

      {/* Category chips (live counts, single-select) */}
      {chipCategories.length > 1 && (
        <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Filter by category">
          <button
            type="button"
            onClick={() => setActiveCategory('')}
            aria-pressed={activeCategory === ''}
            className={`rounded-card border px-3 py-1.5 text-sm font-semibold transition-colors ${
              activeCategory === ''
                ? 'border-signal bg-signal text-asphalt'
                : 'border-line text-ink hover:border-signal hover:text-signal'
            }`}
          >
            All ({entries.length})
          </button>
          {chipCategories.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => setActiveCategory((cur) => (cur === c.slug ? '' : c.slug))}
              aria-pressed={activeCategory === c.slug}
              className={`rounded-card border px-3 py-1.5 text-sm font-semibold transition-colors ${
                activeCategory === c.slug
                  ? 'border-signal bg-signal text-asphalt'
                  : 'border-line text-ink hover:border-signal hover:text-signal'
              }`}
            >
              {c.icon} {c.title} ({categoryCounts.get(c.slug)})
            </button>
          ))}
        </div>
      )}

      <p aria-live="polite" className="mt-4 text-sm text-muted">
        {entries.length === 0
          ? 'No locations loaded yet.'
          : `${results.length} of ${entries.length} location${entries.length === 1 ? '' : 's'}`}
      </p>

      {entries.length === 0 ? (
        <div className="mt-4">
          <DirectoryEmptyState variant="building" categoryTitle={scopeLabel} />
        </div>
      ) : results.length === 0 ? (
        <div className="mt-4">
          <DirectoryEmptyState
            variant="no-results"
            categoryTitle={scopeLabel}
            onClear={
              hasFilters
                ? () => {
                    setQuery('');
                    setActiveCategory('');
                  }
                : undefined
            }
          />
        </div>
      ) : (
        <>
          {featured.length > 0 && (
            <Section label="Featured" entries={featured} headingId="group-featured" />
          )}
          {groups.map(([key, groupEntries], i) => (
            <Section
              key={key}
              label={groupLabel(key, groupBy)}
              entries={groupEntries}
              headingId={`group-${i}-${key.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}
            />
          ))}
        </>
      )}
    </div>
  );
}
