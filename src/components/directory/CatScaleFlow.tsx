'use client';

import { useState } from 'react';
import Link from 'next/link';
import type { DirectoryEntry } from '@/lib/directory/types';
import {
  buildCorridorList,
  sortOrderForDirection,
  type CorridorDirection,
  type CorridorListing,
} from '@/lib/directory/corridor';
import { detailDirectionsUrl } from '@/lib/directory/detail';

/**
 * CAT Scale corridor list — final screen of the Browse Route flow
 * (cat-scales → State → Interstate → Direction). Same honesty contract as
 * the parking flow: order comes from resolveRoutePosition (verified mile
 * marker labeled "Mile marker" — no production row carries one today —
 * else a strictly-parseable exit labeled "Exit"; never relabeled), and
 * anything without a verified position sits under "Route position not
 * verified". Mobile-first: one column, 48px+ targets, no sideways scroll.
 */

function ScaleCard({ item }: { item: CorridorListing }) {
  const { entry } = item;
  const directions = detailDirectionsUrl(entry);
  return (
    <li className="placard p-4">
      <div className="flex items-start gap-4">
        {item.positionLabel ? (
          <div className="shrink-0 text-center">
            <div className="font-display text-3xl leading-none text-signal">
              {item.positionLabel.replace(/^(EXIT|MM) /, '')}
            </div>
            <div className="doc-caption uppercase tracking-widest text-muted">
              {item.positionKind === 'mile-marker' ? 'Mile marker' : 'Exit'}
            </div>
          </div>
        ) : null}
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-lg uppercase leading-snug text-ink">{entry.name}</h3>
          <p className="mt-1 text-sm text-muted">
            {entry.city}, {entry.state}
          </p>
          {entry.phone ? (
            <p className="mt-1 text-sm">
              <a
                className="text-signal underline-offset-4 hover:underline"
                href={`tel:${entry.phone.replace(/[^+\d]/g, '')}`}
              >
                {entry.phone}
              </a>
            </p>
          ) : null}
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

export function CatScaleCorridorList({
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
            <ScaleCard key={item.entry.id} item={item} />
          ))}
        </ul>
      ) : (
        <p className="placard p-4 text-sm text-muted">
          No position-verified CAT Scale listings on this corridor yet.
        </p>
      )}
      {unpositioned.length > 0 ? (
        <section className="mt-8">
          <h2 className="doc-caption mb-3 uppercase tracking-widest text-muted">
            Route position not verified
          </h2>
          <p className="doc-caption mb-3 text-muted">
            These scales are on this interstate but don&rsquo;t carry a verified mile marker or a
            usable exit number, so we won&rsquo;t guess where they fall in the list above.
          </p>
          <ul className="list-none space-y-3 p-0">
            {unpositioned.map((item) => (
              <ScaleCard key={item.entry.id} item={item} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
