'use client';

import { useEffect, useRef, useState } from 'react';
import type { LatLng } from '@/lib/map/bounds';
import {
  MIN_SEARCH_LENGTH,
  type DestinationCandidate,
} from '@/lib/navigator-api/destination-search';
import { searchDestinations } from './search-port';

/**
 * Destination search (pilot round 1) — the driver types a place and picks
 * it from a list. Replaces coordinate entry: no latitude or longitude is
 * ever shown, and the chosen place's coordinates travel to the planner
 * without passing through the screen.
 *
 * Targets are ≥64 px like every other Navigator control, and the whole
 * surface only ever renders inside the stationary-only LockGate.
 */

const DEBOUNCE_MS = 350;

const inputClass =
  'min-h-16 w-full rounded-card border border-line bg-transparent px-4 text-xl text-ink';

const FACILITY_LABEL: Record<string, string> = {
  'truck-stop': 'Truck stop',
  'rest-area': 'Rest area',
  'distribution-center': 'Distribution center',
  warehouse: 'Warehouse',
  'truck-terminal': 'Truck terminal',
  'industrial-park': 'Industrial park',
  'customer-yard': 'Customer yard',
  unknown: '',
};

export function DestinationSearch({
  origin,
  onPick,
  disabled = false,
}: {
  /** The truck's current position — search is biased around it. */
  origin: LatLng | null;
  onPick: (candidate: DestinationCandidate) => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DestinationCandidate[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  // Only the newest search may write state — a slow earlier response must
  // never overwrite a newer list.
  const seqRef = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < MIN_SEARCH_LENGTH || origin === null) {
      setResults([]);
      setSearching(false);
      return;
    }
    const mySeq = ++seqRef.current;
    setSearching(true);
    const timer = setTimeout(() => {
      void searchDestinations(q, origin)
        .then((outcome) => {
          if (mySeq !== seqRef.current) return;
          if (outcome.kind === 'failure') {
            setResults([]);
            setStatus('Search unavailable right now.');
            return;
          }
          setResults(outcome.places);
          setStatus(
            outcome.places.length === 0 ? 'No places found. Try a different search.' : null,
          );
        })
        .finally(() => {
          if (mySeq === seqRef.current) setSearching(false);
        });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, origin]);

  return (
    <div className="space-y-3">
      <label className="block text-lg text-ink/80">
        Where are you going?
        <input
          className={inputClass}
          type="search"
          autoComplete="off"
          value={query}
          disabled={disabled}
          placeholder="Address, business, truck stop, or city"
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search for a destination by address, business, truck stop, or city"
        />
      </label>

      {origin === null ? (
        <p className="text-lg text-ink/70">
          Waiting for a GPS fix — search finds places near your truck.
        </p>
      ) : null}

      <p aria-live="polite" role="status" className="text-lg text-ink/70">
        {searching ? 'Searching…' : (status ?? '')}
      </p>

      {results.length > 0 ? (
        <ul className="space-y-2" aria-label="Destination search results">
          {results.map((place) => {
            const facility = FACILITY_LABEL[place.facility] ?? '';
            return (
              <li key={place.id}>
                <button
                  type="button"
                  className="min-h-16 w-full rounded-card border border-line px-4 py-3 text-left text-ink"
                  onClick={() => {
                    onPick(place);
                    setResults([]);
                    setQuery(place.title);
                    setStatus(null);
                  }}
                >
                  <span className="block text-xl font-semibold">{place.title}</span>
                  {place.address ? (
                    <span className="block text-lg text-ink/70">{place.address}</span>
                  ) : null}
                  <span className="block text-base text-ink/60">
                    {facility ? `${facility} · ` : ''}
                    {place.distanceMi !== null ? `${place.distanceMi} mi away` : ''}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
