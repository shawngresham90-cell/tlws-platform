'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import type { DirectoryEntry } from '@/lib/directory/types';
import {
  buildCorridorList,
  costChips,
  overnightLabel,
  spacesLabel,
  sortOrderForDirection,
  type CorridorDirection,
  type CorridorListing,
} from '@/lib/directory/corridor';
import { detailDirectionsUrl } from '@/lib/directory/detail';

/**
 * Corridor list — the final screen of Parking → State → Interstate →
 * Direction. Mobile-first for a phone in a cab: one column, large route
 * positions, 48px+ touch targets, no horizontal scrolling. A position is
 * labeled "Mile marker" ONLY when the record carries a separately verified
 * mile-marker value (`locations.mile_marker`, migration 047 — no row
 * carries one yet); otherwise it is an exit number labeled "Exit" — never
 * relabeled as MM. Listings with neither sit in the separate "Route
 * position not verified" section. The overnight chip reads the three-way
 * `overnight_status`, so an unreviewed legacy row says "unknown" rather
 * than claiming overnight parking a driver can't rely on.
 */

function ListingCard({ item }: { item: CorridorListing }) {
  const { entry } = item;
  const directions = detailDirectionsUrl(entry);
  const overnight = overnightLabel(entry);
  const chips = costChips(entry);
  return (
    <li className="placard p-4">
      <div className="flex items-start gap-4">
        {item.positionLabel ? (
          <div className="shrink-0 text-center">
            <div className="font-display text-3xl leading-none text-signal">
              {item.positionLabel.replace(/^(EXIT|MM) /, '')}
            </div>
            {/* "Mile marker" ONLY for a separately verified mile-marker value —
                an exit number is never relabeled as MM. */}
            <div className="doc-caption uppercase tracking-widest text-muted">
              {item.positionKind === 'mile-marker' ? 'Mile marker' : 'Exit'}
            </div>
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-display text-lg uppercase text-ink">{entry.name}</h3>
          <p className="mt-1 text-sm text-muted">{spacesLabel(entry.parkingSpaces)}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {chips.map((c) => (
              <span
                key={c}
                className="doc-caption rounded-card border border-line px-2 py-0.5 uppercase tracking-wider text-ink"
              >
                {c}
              </span>
            ))}
            {/* Confirmed / prohibited / unknown come from overnight_status —
                the evidence-backed column — never from the legacy boolean. */}
            <span
              className={cn(
                'doc-caption rounded-card border px-2 py-0.5 uppercase tracking-wider',
                overnight === 'Overnight confirmed' && 'border-marker text-marker-300',
                overnight === 'Overnight prohibited' && 'border-signal text-signal',
                overnight === 'Overnight unknown' && 'border-line text-muted',
              )}
            >
              {overnight}
            </span>
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        {directions ? (
          <a
            href={directions}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-[48px] items-center justify-center rounded-card bg-signal px-4 font-display uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt"
          >
            Directions
            <span className="sr-only"> to {entry.name} (opens in new tab)</span>
          </a>
        ) : (
          <span className="inline-flex min-h-[48px] items-center justify-center rounded-card border border-line px-4 font-display uppercase tracking-wide text-muted">
            No directions
          </span>
        )}
        {entry.detailSlug ? (
          <Link
            href={`/directory/location/${entry.detailSlug}`}
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
  );
}

export function CorridorList({
  entries,
  direction,
}: {
  entries: DirectoryEntry[];
  direction: CorridorDirection;
}) {
  const [ascending, setAscending] = useState(sortOrderForDirection(direction) === 'asc');
  const { positioned, unpositioned } = buildCorridorList(entries);
  const ordered = ascending ? positioned : [...positioned].reverse();

  return (
    <div>
      <button
        type="button"
        onClick={() => setAscending((a) => !a)}
        aria-pressed={!ascending}
        className="mb-4 flex min-h-[56px] w-full items-center justify-center gap-3 rounded-card border border-line font-display text-lg uppercase tracking-wide text-ink transition-colors hover:border-signal focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal"
      >
        {ascending ? 'LOW → HIGH' : 'HIGH → LOW'}
        <span aria-hidden="true">⇅</span>
      </button>
      <p className="doc-caption mb-4 text-muted">
        Listed in route order for your direction of travel — by verified mile marker where a listing
        has one, otherwise by exit number. Exit numbers follow mile markers in most states, and most
        exits serve both directions.
      </p>
      {ordered.length > 0 ? (
        <ul className="list-none space-y-3 p-0">
          {ordered.map((item) => (
            <ListingCard key={item.entry.id} item={item} />
          ))}
        </ul>
      ) : (
        <p className="placard p-4 text-sm text-muted">
          No position-verified listings on this corridor yet.
        </p>
      )}
      {unpositioned.length > 0 ? (
        <section className="mt-8">
          <h2 className="doc-caption mb-3 uppercase tracking-widest text-muted">
            Route position not verified
          </h2>
          <p className="doc-caption mb-3 text-muted">
            These listings are on this interstate but don&rsquo;t carry a verified mile marker or a
            usable exit number, so we won&rsquo;t guess where they fall in the list above.
          </p>
          <ul className="list-none space-y-3 p-0">
            {unpositioned.map((item) => (
              <ListingCard key={item.entry.id} item={item} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
