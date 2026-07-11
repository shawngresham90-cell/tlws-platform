import Link from 'next/link';
import type { DirectoryEntry } from '@/lib/directory/types';
import { NEARBY_CATEGORIES, groupByCategory } from '@/lib/directory/related';
import { interstateSlug, exitSlug } from '@/lib/directory/interstates';

/**
 * "Nearby Truck Stops / Parking / CAT Scales / Truck Washes" — compact,
 * crawlable lists derived from state/interstate/exit data (no map, no
 * coordinates required). Each item links to the most specific page that
 * covers it: its exit page when it has one, otherwise its category page.
 */

const MAX_PER_CATEGORY = 6;

function bestHref(entry: DirectoryEntry): string {
  if (entry.interstate && entry.exitNumber) {
    const slug = interstateSlug(entry.interstate);
    if (slug) return `/directory/${slug}/${exitSlug(entry.exitNumber)}`;
  }
  return `/directory/${entry.category}`;
}

export function NearbySections({
  entries,
  scopeLabel,
  excludeIds = new Set<string>(),
}: {
  /** Candidate pool (already scoped to the state/corridor/exit window). */
  entries: DirectoryEntry[];
  /** e.g. "Georgia", "I-75", "I-75 Exit 60". */
  scopeLabel: string;
  /** Entries already shown on the page (excluded from "nearby"). */
  excludeIds?: Set<string>;
}) {
  const pool = entries.filter((e) => !excludeIds.has(e.id));
  const byCategory = groupByCategory(pool);
  const sections = NEARBY_CATEGORIES.map((c) => ({
    ...c,
    items: (byCategory[c.slug] ?? []).slice(0, MAX_PER_CATEGORY),
  })).filter((s) => s.items.length > 0);

  if (sections.length === 0) return null;

  return (
    <section className="mt-12" aria-label={`Nearby driver services around ${scopeLabel}`}>
      <h2 className="font-display text-2xl uppercase text-ink">Around {scopeLabel}</h2>
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        {sections.map((s) => (
          <div key={s.slug} className="rounded-card border border-line bg-asphalt-800 p-5">
            <h3 className="font-display text-lg uppercase text-ink">{s.heading}</h3>
            <ul className="mt-3 grid gap-2">
              {s.items.map((e) => (
                <li key={e.id} className="text-sm">
                  <Link
                    href={bestHref(e)}
                    className="font-semibold text-ink transition-colors hover:text-signal"
                  >
                    {e.name}
                  </Link>{' '}
                  <span className="text-muted">
                    — {e.city}, {e.state}
                    {e.interstate && e.exitNumber ? ` · ${e.interstate} Exit ${e.exitNumber}` : ''}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs">
              <Link
                href={`/directory/${s.slug}`}
                className="font-semibold text-signal underline-offset-4 hover:underline"
              >
                All {s.heading.replace('Nearby ', '').toLowerCase()} →
              </Link>
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
