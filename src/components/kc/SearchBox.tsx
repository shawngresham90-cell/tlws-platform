/**
 * Knowledge Center search box. Pure HTML GET form to /knowledge/search — no
 * client JS, works everywhere, and the query lands in the URL (shareable,
 * indexable results page). Server does the ranked full-text search.
 */
export function SearchBox({ defaultValue = '' }: { defaultValue?: string }) {
  return (
    <form action="/knowledge/search" method="get" role="search" className="flex max-w-lg gap-3">
      <label htmlFor="kc-q" className="sr-only">
        Search the Knowledge Center
      </label>
      <input
        id="kc-q"
        name="q"
        type="search"
        defaultValue={defaultValue}
        placeholder="Search DOT rules, HOS, CDL prep…"
        className="flex-1 rounded-card border border-line bg-asphalt px-4 py-3 text-ink outline-none focus:border-signal"
      />
      <button
        type="submit"
        className="rounded-card bg-signal px-5 py-3 font-display text-sm uppercase text-asphalt transition-colors hover:bg-signal-600"
      >
        Search
      </button>
    </form>
  );
}
