import Link from 'next/link';
import type { NearbySection } from '@/lib/directory/detail';
import { detailHref } from '@/lib/directory/detail-slug';

/**
 * "Nearby X" sections for a listing detail page (Milestone 20). Same visual
 * language as NearbySections, but items are ranked by real distance when both
 * sides have coordinates (badge shows miles) and each item links to its own
 * detail page.
 */
export function DetailNearbySections({
  sections,
  scopeLabel,
}: {
  sections: NearbySection[];
  /** e.g. "Pilot Travel Center #4558". */
  scopeLabel: string;
}) {
  if (sections.length === 0) return null;

  return (
    <section className="mt-12" aria-label={`Driver services near ${scopeLabel}`}>
      <h2 className="font-display text-2xl uppercase text-ink">Nearby driver services</h2>
      <div className="mt-4 grid gap-6 sm:grid-cols-2">
        {sections.map((s) => (
          <div key={s.slug} className="rounded-card border border-line bg-asphalt-800 p-5">
            <h3 className="font-display text-lg uppercase text-ink">{s.heading}</h3>
            <ul className="mt-3 grid gap-2">
              {s.items.map(({ entry, distanceMiles }) => (
                <li key={entry.id} className="text-sm">
                  <Link
                    href={entry.detailSlug ? detailHref(entry.detailSlug) : `/directory/${entry.category}`}
                    className="font-semibold text-ink transition-colors hover:text-signal"
                  >
                    {entry.name}
                  </Link>{' '}
                  <span className="text-muted">
                    — {entry.city}, {entry.state}
                    {distanceMiles != null ? ` · ${distanceMiles} mi` : ''}
                    {distanceMiles == null && entry.interstate && entry.exitNumber
                      ? ` · ${entry.interstate} Exit ${entry.exitNumber}`
                      : ''}
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
