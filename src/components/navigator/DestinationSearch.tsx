'use client';

import { useEffect, useRef, useState } from 'react';
import type { LatLng } from '@/lib/map/bounds';
import {
  MIN_SEARCH_LENGTH,
  type DestinationCandidate,
} from '@/lib/navigator-api/destination-search';
import {
  createSearchCoordinator,
  type SearchContext,
  type SearchCoordinator,
} from '@/lib/navigator-api/search-coordination';
import { searchDestinations, NAVIGATOR_SEARCH_ENDPOINT } from './search-port';
import { KM_PER_MILE } from '@/lib/navigator/format-units';

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
  metric = false,
}: {
  place: DestinationCandidate;
  onSelect: (candidate: DestinationCandidate) => void;
  /** Straight-line distance in kilometres rather than miles. */
  metric?: boolean;
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
              <span className="num-data">
                ≈{' '}
                {metric
                  ? `${(place.distanceMi * KM_PER_MILE).toFixed(1)} km`
                  : `${place.distanceMi} mi`}
              </span>{' '}
              away · straight line
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
  country = 'USA',
  metric = false,
  endpoint = NAVIGATOR_SEARCH_ENDPOINT,
  label = 'Where are you going?',
  placeholder = 'Address, business, truck stop, or city',
  ariaLabel = 'Search for a destination by address, business, truck stop, or city',
  unbiasedNote = "Location hasn't started yet — include the city or state. Results aren't sorted by distance until it does.",
  testId,
}: {
  /** The truck's current position — search is biased around it. */
  origin: LatLng | null;
  onPick: (candidate: DestinationCandidate) => void;
  /** The driver edited the query after choosing — drop the old pick. */
  onClear: () => void;
  disabled?: boolean;
  /**
   * Which country this search asks about (Canada milestone). Changing it
   * re-runs the search, because "Petro" means different places on either
   * side of the border — and that is the whole point of the control that
   * changes it.
   */
  country?: 'USA' | 'CAN';
  /** Show straight-line distances in kilometres rather than miles. */
  metric?: boolean;
  /**
   * Which door to knock on. The SEARCH is the same either way; the
   * Navigator's endpoint requires a pilot cookie and Plan My Day's
   * visitors do not have one, so the door is a parameter rather than a
   * second implementation.
   */
  endpoint?: string;
  /** Field label — Plan My Day asks this twice, for origin and destination. */
  label?: string;
  placeholder?: string;
  ariaLabel?: string;
  /**
   * What to say when there is no origin to bias around. The Navigator is
   * waiting for a GPS fix; Plan My Day never has one, so the same state
   * needs a different sentence rather than a borrowed one that would
   * describe a permission this screen never asks for.
   */
  unbiasedNote?: string;
  /** Hook for the browser bench to tell two search boxes apart. */
  testId?: string;
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

  // What the coordinator caches under, and what this effect re-runs for,
  // are the SAME four things. Keeping one list means a cache slot can
  // never outlive the context that produced it: whenever a change is
  // worth re-asking the provider, it is also worth a different slot.
  const searchContext: SearchContext = { country, endpoint, originKey };

  useEffect(() => {
    if (settled) return;
    const q = query.trim();
    if (q.length < MIN_SEARCH_LENGTH) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    const timer = setTimeout(() => {
      // The origin is read at fire time and MAY be null: the simplified
      // startup searches before location exists (permission arrives with
      // the Start tap), and the server's unbiased mode answers then.
      const at = originRef.current;
      const coord = coordRef.current;
      if (coord === null) {
        setSearching(false);
        return;
      }
      // The coordinator decides whether this query is worth a provider
      // transaction at all, and whether an answer is still current when
      // it lands. Retyping a query the driver already searched costs
      // nothing.
      const decision = coord.next(q, searchContext, { settled: false });
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
      void searchDestinations(decision.query, at, undefined, country, endpoint).then((outcome) => {
        // AN ANSWER AND AN ATTEMPT SETTLE DIFFERENTLY. A failure is
        // reported as a failure, so nothing about it is remembered and
        // the same query stays askable; only a real answer — including a
        // real empty one — may be cached. There is no longer a method
        // that would let this branch say "it succeeded with nothing".
        const isCurrent =
          outcome.kind === 'failure'
            ? coord.settleFailure(decision.seq)
            : coord.acceptSuccess(decision.seq, outcome.places);
        // A slower earlier response can never overwrite a newer one —
        // and that includes the spinner. An old attempt clearing
        // `searching` would tell the driver the search it can still see
        // running had stopped.
        if (!isCurrent) return;
        setSearching(false);
        if (outcome.kind === 'failure') {
          setResults([]);
          // What is known is that the request did not work — NOT that the
          // place does not exist. Those are different sentences and the
          // driver is owed the true one.
          setStatus('Search unavailable right now.');
          return;
        }
        setResults(outcome.places);
        setStatus(outcome.places.length === 0 ? 'No places found. Try a different search.' : null);
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // `searchContext` is rebuilt every render from exactly these four
    // values, so listing them keeps the effect stable while a moving
    // truck re-renders at 1 Hz.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, originKey, settled, country, endpoint]);

  return (
    <div className="space-y-3" data-destination-search={testId ?? ''}>
      <label className="block text-lg text-ink/80">
        {label}
        <input
          className={inputClass}
          type="search"
          autoComplete="off"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
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
          aria-label={ariaLabel}
        />
      </label>

      {/* Honest bias note: with no position yet, results are real places
          but are NOT sorted by distance from the truck, and no "mi away"
          line renders (the server strips distances in unbiased mode). */}
      {origin === null ? <p className="text-lg text-ink/70">{unbiasedNote}</p> : null}

      <p aria-live="polite" role="status" className="text-lg text-ink/70">
        {searching ? 'Searching…' : (status ?? '')}
      </p>

      {results.length > 0 ? (
        <ul className="space-y-2" aria-label="Destination search results">
          {results.map((place) => (
            <li key={place.id}>
              <SearchResultCard
                place={place}
                metric={metric}
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
