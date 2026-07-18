'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { PlannerAnchor } from '@/lib/trip-planner/directory-loader';
import {
  filterDirectoryAnchors,
  hereMatchesToPlaces,
  mergePlaceResults,
  placeBadge,
  type PlaceResult,
} from '@/lib/trip-planner/place-search';

/**
 * Free-text origin/destination combobox (free-text search milestone). Accepts
 * a city+state, street address, ZIP, or directory location. Directory anchors
 * (already loaded, offline) are filtered instantly; arbitrary places come from
 * server-side HERE geocoding via /api/trip-planner/places. Every suggestion is
 * badged so a driver can tell a Directory truck stop from a City/Address/ZIP.
 *
 * Selection is explicit: the parent only receives coordinates when the user
 * picks a suggestion. Editing the text after a pick clears the selection, so a
 * stale/ambiguous coordinate can never be submitted.
 */

const inputCls =
  'w-full rounded-card border border-line bg-asphalt-800 px-4 py-3 text-base text-ink ' +
  'focus:border-signal focus:outline-none';

const MIN_CHARS = 3;
const DEBOUNCE_MS = 300;

type PlacesResponse = { ok: boolean; places?: PlaceResult[] };

export function PlaceCombobox({
  id,
  label,
  placeholder,
  anchors,
  selected,
  onSelect,
}: {
  id: string;
  label: string;
  placeholder: string;
  anchors: PlannerAnchor[];
  selected: PlaceResult | null;
  onSelect: (place: PlaceResult | null) => void;
}) {
  const [query, setQuery] = useState('');
  const [remote, setRemote] = useState<PlaceResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);

  // Local directory matches are instant and free — no network per keystroke.
  const directory = useMemo(() => filterDirectoryAnchors(anchors, query, 5), [anchors, query]);
  const suggestions = useMemo(() => mergePlaceResults(directory, remote, 8), [directory, remote]);

  // Debounced HERE geocoding for arbitrary places. Fail-soft: on any error the
  // remote list is simply empty and directory suggestions still show.
  useEffect(() => {
    const q = query.trim();
    if (selected && q === selected.label) return; // don't re-search a picked value
    if (q.length < MIN_CHARS) {
      setRemote([]);
      setSearched(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const t = setTimeout(() => {
      void fetch(`/api/trip-planner/places?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : { ok: false }))
        .then((d: PlacesResponse) => {
          if (cancelled) return;
          setRemote(d.ok && d.places ? d.places : []);
          setSearched(true);
        })
        .catch(() => {
          if (!cancelled) {
            setRemote([]);
            setSearched(true);
          }
        })
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, selected]);

  // Close the dropdown on outside click.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const pick = (p: PlaceResult) => {
    onSelect(p);
    setQuery(p.label);
    setOpen(false);
  };

  const showNoMatch =
    open && searched && !loading && query.trim().length >= MIN_CHARS && suggestions.length === 0;

  return (
    <div ref={boxRef} className="relative">
      <label
        className="mt-4 block text-xs font-semibold uppercase tracking-wide text-muted"
        htmlFor={id}
      >
        {label}
      </label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-controls={`${id}-listbox`}
        className={inputCls}
        placeholder={placeholder}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          if (selected) onSelect(null); // editing clears a prior pick
        }}
        onFocus={() => setOpen(true)}
      />
      {selected && (
        <p className="mt-1 text-xs text-signal">
          ✓ Using {placeBadge(selected).toLowerCase()}: {selected.label}
        </p>
      )}

      {open && suggestions.length > 0 && (
        <ul
          id={`${id}-listbox`}
          role="listbox"
          className="absolute z-10 mt-1 max-h-72 w-full overflow-auto rounded-card border border-line bg-asphalt-800 shadow-lg"
        >
          {suggestions.map((p) => (
            <li key={p.id} role="option" aria-selected={selected?.id === p.id}>
              <button
                type="button"
                onClick={() => pick(p)}
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left text-sm text-ink hover:bg-asphalt-700"
              >
                <span className="truncate">{p.label}</span>
                <span
                  className={
                    'shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ' +
                    (p.source === 'directory'
                      ? 'bg-signal/20 text-signal'
                      : 'bg-line/60 text-muted')
                  }
                >
                  {placeBadge(p)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {showNoMatch && (
        <p className="mt-1 text-xs text-diesel">
          No matches for “{query.trim()}”. Try a city &amp; state, street address, or ZIP.
        </p>
      )}
      {open && loading && suggestions.length === 0 && (
        <p className="mt-1 text-xs text-muted">Searching…</p>
      )}
    </div>
  );
}
