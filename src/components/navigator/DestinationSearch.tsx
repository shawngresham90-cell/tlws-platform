'use client';

import { useEffect, useRef, useState } from 'react';
import type { LatLng } from '@/lib/map/bounds';
import {
  MIN_SEARCH_LENGTH,
  type DestinationCandidate,
} from '@/lib/navigator-api/destination-search';
import {
  createSearchCoordinator,
  type SearchCoordinator,
} from '@/lib/navigator-api/search-coordination';
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
  'min-h-16 w-full rounded-cockpit border border-line bg-nav-surface px-4 text-xl text-ink';

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

/**
 * One destination card (Design Blueprint Phase 4). Every line is a REAL
 * candidate field the provider returned — facility class from HERE's own
 * categories, the place's name and postal address, and HERE's straight-
 * line distance, said to be straight-line so nobody reads it as route
 * distance. Nothing is inferred from the business name: a place called
 * "Pilot" earns no parking, fuel, or shower claims here, because this app
 * has no data source for any of that. Coordinates never render.
 *
 * The whole card is the button — one obvious tap, ≥64px, parked-only by
 * the LockGate this surface already lives behind. Exported for the design
 * harness, which renders it with fixture candidates.
 */
export function SearchResultCard({
  place,
  onSelect,
}: {
  place: DestinationCandidate;
  onSelect: (candidate: DestinationCandidate) => void;
}) {
  const facility = FACILITY_LABEL[place.facility] ?? '';
  return (
    <button
      type="button"
      className="min-h-16 w-full rounded-cockpit border border-line bg-nav-surface px-4 py-3 text-left text-ink motion-safe:transition-colors motion-safe:duration-200 active:bg-nav-surface-2"
      onClick={() => onSelect(place)}
    >
      <span className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          {facility ? (
            <span className="block text-sm font-semibold uppercase tracking-[0.15em] text-ink/60">
              {facility}
            </span>
          ) : null}
          <span className="block text-xl font-semibold leading-snug">{place.title}</span>
          {place.address ? (
            <span className="block text-lg leading-snug text-ink/70">{place.address}</span>
          ) : null}
          {place.distanceMi !== null ? (
            <span className="mt-1 block text-base text-ink/60">
              <span className="num-data">≈ {place.distanceMi} mi</span> away · straight line
            </span>
          ) : null}
        </span>
        {/* Affordance only — the words and the tap target carry the action. */}
        <span aria-hidden="true" className="shrink-0 text-3xl leading-none text-ink/40">
          ›
        </span>
      </span>
    </button>
  );
}

export function DestinationSearch({
  origin,
  onPick,
  onClear,
  disabled = false,
}: {
  /** The truck's current position — search is biased around it. */
  origin: LatLng | null;
  onPick: (candidate: DestinationCandidate) => void;
  /** The driver edited the query after choosing — drop the old pick. */
  onClear: () => void;
  disabled?: boolean;
}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DestinationCandidate[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);
  // Once a place is chosen the search is DONE. Without this the query
  // still holds the picked title, so the effect would immediately search
  // again for it and repopulate the list under the driver's finger.
  const [settled, setSettled] = useState(false);
  // Owns request sequencing, same-query caching and staleness. One per
  // mounted search box.
  const coordRef = useRef<SearchCoordinator | null>(null);
  if (coordRef.current === null) coordRef.current = createSearchCoordinator();
  // The live origin, read at FIRE time. Kept in a ref so a moving truck
  // never re-triggers the effect (see originKey below).
  const originRef = useRef(origin);
  originRef.current = origin;

  // The effect must not depend on the `origin` OBJECT: the driving screen
  // re-renders on every GPS tick (1 Hz) and passes a fresh object literal
  // each time, which restarted the debounce and re-issued a request every
  // second — the flashing the road test saw. A coarse key (~110 m) is
  // enough to re-bias results if the truck actually moves.
  const originKey = origin === null ? null : `${origin.lat.toFixed(3)},${origin.lng.toFixed(3)}`;

  useEffect(() => {
    if (settled) return;
    const q = query.trim();
    if (q.length < MIN_SEARCH_LENGTH || originKey === null) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      const at = originRef.current;
      const coord = coordRef.current;
      if (at === null || coord === null) {
        setSearching(false);
        return;
      }
      // The coordinator decides whether this query is worth a provider
      // transaction at all, and whether an answer is still current when
      // it lands. Retyping a query the driver already searched costs
      // nothing.
      const decision = coord.next(q, { settled: false });
      if (decision.kind === 'idle') {
        setSearching(false);
        return;
      }
      if (decision.kind === 'cached') {
        setResults(decision.places);
        setStatus(decision.places.length === 0 ? 'No places found. Try a different search.' : null);
        setSearching(false);
        return;
      }
      void searchDestinations(decision.query, at)
        .then((outcome) => {
          if (outcome.kind === 'failure') {
            if (coord.accept(decision.seq, [])) {
              setResults([]);
              setStatus('Search unavailable right now.');
            }
            return;
          }
          // A slower earlier response can never overwrite a newer one.
          if (!coord.accept(decision.seq, outcome.places)) return;
          setResults(outcome.places);
          setStatus(
            outcome.places.length === 0 ? 'No places found. Try a different search.' : null,
          );
        })
        .finally(() => setSearching(false));
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, originKey, settled]);

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
          onChange={(e) => {
            setQuery(e.target.value);
            // Editing the text means the driver is choosing again: reopen
            // the search and drop the previous pick so a stale selection
            // can never be planned behind new text.
            if (settled) {
              setSettled(false);
              onClear();
            }
          }}
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
          {results.map((place) => (
            <li key={place.id}>
              <SearchResultCard
                place={place}
                onSelect={(chosen) => {
                  // Selecting ENDS the search: abandon any in-flight
                  // response, mark settled so the effect stops, and
                  // clear the list and the status line.
                  coordRef.current?.cancel();
                  setSettled(true);
                  setSearching(false);
                  setResults([]);
                  setQuery(chosen.title);
                  setStatus(null);
                  onPick(chosen);
                }}
              />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
