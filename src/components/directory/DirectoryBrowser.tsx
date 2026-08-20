'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DirectoryBrowseIndexEntry, DirectoryCardEntry } from '@/lib/directory/dto';
import { DIRECTORY_PAGE, filterAndSortEntries, type SortKey } from '@/lib/directory/browse';
import { trackEvent } from '@/lib/analytics';
import { DIRECTORY_EVENTS, filterEventProps, searchEventProps } from '@/lib/directory/funnel';
import { EntryCard } from './EntryCard';
import { DirectoryEmptyState } from './DirectoryEmptyState';

/**
 * The interactive half of every directory page: search (name, city, state,
 * ZIP, interstate), state/city filters, sorting (featured / A–Z / newest /
 * distance via browser geolocation), and lazy "load more" rendering so a
 * thousand-listing category doesn't paint a thousand cards up front. The
 * filter/sort logic lives in lib/directory/browse.ts (pure, tested).
 *
 * TWO INPUTS, ONE COMPLETE SET (DIR-PAYLOAD-1). The page hands over:
 *
 *   index         EVERY published listing in this scope, compact — the fields
 *                 search, the filters, the sorts and the count read. This is
 *                 what makes "1,882 of 1,882" honest and a tail listing
 *                 findable; it is complete, always, and it never shrinks.
 *   initialCards  the first window, ready to render, matching what the server
 *                 already put in the HTML.
 *
 * Cards for any LATER window are fetched by id from /api/directory/cards and
 * kept. Before this split, the page serialized all 1,882 rows at full width
 * to render thirty of them — 161 kB Brotli of listing data on a page that
 * shows thirty cards.
 *
 * What this deliberately does NOT do is ask a server what matches. Filtering
 * stays local and instant over the complete index, so a driver typing on a
 * truck-stop connection never waits on a round trip to find out whether their
 * stop is listed. The network is only ever asked for the DETAILS of rows the
 * browser has already decided to show.
 */
const inputClasses =
  'w-full rounded-card border border-line bg-asphalt-800 px-4 py-3 text-ink placeholder:text-muted/60 ' +
  'focus:border-signal focus:outline-none';

/** The window size, owned by lib/directory/browse (see the note there). */
const PAGE = DIRECTORY_PAGE;

/** Must not exceed the route's own CARD_LOOKUP_MAX_IDS. */
const CARD_BATCH = 30;

export function DirectoryBrowser({
  categoryTitle,
  index,
  initialCards,
}: {
  categoryTitle: string;
  /** Complete, compact: every published listing in this scope. */
  index: DirectoryBrowseIndexEntry[];
  /** The first window, already rendered into the server HTML. */
  initialCards: DirectoryCardEntry[];
}) {
  const [query, setQuery] = useState('');
  const [state, setState] = useState('');
  const [city, setCity] = useState('');
  const [sort, setSort] = useState<SortKey>('featured');
  const [visible, setVisible] = useState(PAGE);
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(null);
  const [geoStatus, setGeoStatus] = useState<'idle' | 'asking' | 'denied'>('idle');

  const stateOptions = useMemo(() => [...new Set(index.map((e) => e.state))].sort(), [index]);
  const cityOptions = useMemo(
    () => [...new Set(index.filter((e) => !state || e.state === state).map((e) => e.city))].sort(),
    [index, state],
  );

  const results = useMemo(
    () => filterAndSortEntries(index, { query, state, city, sort, origin }),
    [index, query, state, city, sort, origin],
  );
  const shown = useMemo(() => results.slice(0, visible), [results, visible]);

  const hasFilters = Boolean(query.trim() || state || city);

  /* ------------------------------------------------------------- cards */

  // Seeded with the window the server already rendered, so the first paint
  // needs no request and hydration matches the HTML exactly.
  const [cards, setCards] = useState<Map<string, DirectoryCardEntry>>(
    () => new Map(initialCards.map((c) => [c.id, c])),
  );
  const [cardsFailed, setCardsFailed] = useState(false);
  const [fetching, setFetching] = useState(false);
  // Ids already asked for — so a slow request is not re-issued on every
  // keystroke, and a retry has something to retry.
  const requestedRef = useRef<Set<string>>(new Set(initialCards.map((c) => c.id)));
  // Only the newest lookup may write. An earlier one landing late must not
  // overwrite state that a later query already produced.
  const lookupRef = useRef(0);

  const missing = useMemo(
    () => shown.filter((e) => !cards.has(e.id)).map((e) => e.id),
    [shown, cards],
  );

  const fetchCards = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const token = ++lookupRef.current;
    setFetching(true);
    try {
      const batch = ids.slice(0, CARD_BATCH);
      const res = await fetch(`/api/directory/cards?ids=${batch.join(',')}`, {
        headers: { Accept: 'application/json' },
      });
      const body = (await res.json()) as {
        ok?: boolean;
        data?: { cards?: DirectoryCardEntry[] };
      };
      if (token !== lookupRef.current) return; // stale — a newer lookup owns the UI
      if (!res.ok || !body.ok || !body.data?.cards) {
        setCardsFailed(true);
        return;
      }
      for (const id of batch) requestedRef.current.add(id);
      setCards((prev) => {
        const next = new Map(prev);
        for (const card of body.data!.cards!) next.set(card.id, card);
        return next;
      });
      setCardsFailed(false);
    } catch {
      if (token === lookupRef.current) setCardsFailed(true);
    } finally {
      if (token === lookupRef.current) setFetching(false);
    }
  }, []);

  // One lookup per newly-visible window. Never retried automatically: a
  // failing endpoint answering thirty ids per keystroke is how a page becomes
  // its own denial of service. The driver gets a Retry button instead.
  useEffect(() => {
    if (cardsFailed) return;
    const unasked = missing.filter((id) => !requestedRef.current.has(id));
    if (unasked.length === 0) return;
    for (const id of unasked) requestedRef.current.add(id);
    void fetchCards(unasked);
  }, [missing, cardsFailed, fetchCards]);

  function retryCards() {
    for (const id of missing) requestedRef.current.delete(id);
    setCardsFailed(false);
  }

  // --- analytics ---------------------------------------------------------
  // Search is a live filter, so a keystroke is not a "search". Debounce until
  // typing settles, then emit ONCE per settled query. The query text never
  // leaves the browser (a driver may type a name or phone number) — only its
  // length and the result count do.
  const lastSearchRef = useRef<string | null>(null);
  useEffect(() => {
    const q = query.trim();
    const t = setTimeout(() => {
      if (lastSearchRef.current === q) return;
      lastSearchRef.current = q;
      if (!q) return; // clearing the box is not a search
      trackEvent(
        DIRECTORY_EVENTS.search,
        searchEventProps(q, results.length, {
          category: categoryTitle,
          surface: 'directory-browser',
        }),
      );
    }, 700);
    return () => clearTimeout(t);
  }, [query, results.length, categoryTitle]);

  function trackFilter(name: string, value: string | null) {
    const props = filterEventProps(name, value, { category: categoryTitle });
    if (props) trackEvent(DIRECTORY_EVENTS.filter, props);
  }

  function clearFilters() {
    setQuery('');
    setState('');
    setCity('');
    setVisible(PAGE);
    trackFilter('all', null);
  }

  function chooseSort(next: SortKey) {
    setSort(next);
    trackFilter('sort', next);
    setVisible(PAGE);
    if (next === 'distance' && !origin && typeof navigator !== 'undefined') {
      if (!navigator.geolocation) {
        setGeoStatus('denied');
        return;
      }
      setGeoStatus('asking');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setOrigin({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          setGeoStatus('idle');
        },
        () => setGeoStatus('denied'),
        { maximumAge: 300_000, timeout: 10_000 },
      );
    }
  }

  return (
    <div>
      {/* Search + filters + sort — stacks on mobile, one row on desktop */}
      <div className="grid gap-3 lg:grid-cols-[1fr_auto_auto_auto]">
        <div>
          <label htmlFor="directory-search" className="sr-only">
            Search {categoryTitle}
          </label>
          <input
            id="directory-search"
            type="search"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setVisible(PAGE);
            }}
            placeholder={`Search name, city, state, ZIP, interstate…`}
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
              setVisible(PAGE);
              trackFilter('state', e.target.value || null);
            }}
            disabled={stateOptions.length === 0}
            className={`${inputClasses} lg:w-40 disabled:opacity-50`}
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
            onChange={(e) => {
              setCity(e.target.value);
              setVisible(PAGE);
              trackFilter('city', e.target.value || null);
            }}
            disabled={cityOptions.length === 0}
            className={`${inputClasses} lg:w-40 disabled:opacity-50`}
          >
            <option value="">All cities</option>
            {cityOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="directory-sort" className="sr-only">
            Sort
          </label>
          <select
            id="directory-sort"
            value={sort}
            onChange={(e) => chooseSort(e.target.value as SortKey)}
            className={`${inputClasses} lg:w-44`}
          >
            <option value="featured">Sponsored first</option>
            <option value="alpha">A–Z</option>
            <option value="newest">Newest</option>
            <option value="distance">Nearest to me</option>
          </select>
        </div>
      </div>

      {/* Result count + geolocation status (screen-reader announced) */}
      <p aria-live="polite" className="mt-4 text-sm text-muted">
        {index.length === 0
          ? 'No locations loaded yet.'
          : `${results.length} of ${index.length} location${index.length === 1 ? '' : 's'}`}
        {sort === 'distance' && geoStatus === 'asking' && ' · finding your location…'}
        {sort === 'distance' && geoStatus === 'denied' && ' · location unavailable — sorted A–Z'}
        {sort === 'distance' && origin && ' · sorted by distance from you'}
      </p>

      {/* Results / empty states */}
      <div className="mt-4">
        {index.length === 0 ? (
          <DirectoryEmptyState variant="building" categoryTitle={categoryTitle} />
        ) : results.length === 0 ? (
          <DirectoryEmptyState
            variant="no-results"
            categoryTitle={categoryTitle}
            onClear={hasFilters ? clearFilters : undefined}
          />
        ) : (
          <>
            {/* A failed card lookup says so. It is NOT allowed to read as "no
                match" — the index already proved these listings match. */}
            {cardsFailed && missing.length > 0 && (
              <p
                role="status"
                className="mb-4 rounded-card border border-diesel/40 bg-diesel/10 px-4 py-3 text-sm text-ink"
              >
                Full details for some of these listings are temporarily unavailable.{' '}
                <button
                  type="button"
                  onClick={retryCards}
                  className="font-semibold text-signal underline underline-offset-4"
                >
                  Try again
                </button>
              </p>
            )}
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {shown.map((e) => {
                const card = cards.get(e.id);
                return card ? (
                  <EntryCard key={e.id} entry={card} />
                ) : (
                  <PendingCard key={e.id} entry={e} failed={cardsFailed} />
                );
              })}
            </div>
            {results.length > visible && (
              <div className="mt-8 text-center">
                <button
                  type="button"
                  onClick={() => setVisible((v) => v + PAGE)}
                  disabled={fetching}
                  className="rounded-card border border-line px-6 py-3 font-display text-lg uppercase tracking-wide text-ink transition-colors hover:border-signal hover:text-signal disabled:opacity-60"
                >
                  Load more ({results.length - visible} left)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

/**
 * A listing whose card fields have not arrived yet. It shows the listing —
 * name, city, state, all of which the index already carries — rather than a
 * blank shimmer, because a driver scanning for their stop can already tell
 * whether this is it. Never rendered on first paint: the initial window comes
 * from the server with its cards.
 */
function PendingCard({ entry, failed }: { entry: DirectoryBrowseIndexEntry; failed: boolean }) {
  return (
    <div className="flex flex-col rounded-card border border-line bg-asphalt-800 p-5">
      <h3 className="font-display text-lg uppercase text-ink">{entry.name}</h3>
      <p className="mt-1 text-sm text-muted">
        {entry.city}, {entry.state}
      </p>
      <p className="mt-3 text-sm text-muted">
        {failed ? 'Details unavailable right now.' : 'Loading details…'}
      </p>
    </div>
  );
}
