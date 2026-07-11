import Link from 'next/link';

/**
 * Cross-page link block (Milestone 18 SEO): every directory page points to
 * its related state / interstate / exit / category pages plus the driver
 * community pages, so link equity and crawl paths flow through the whole
 * directory instead of dead-ending at the hub.
 */

export type RelatedLinkGroup = {
  heading: string;
  links: { href: string; label: string }[];
};

const chip =
  'rounded-card border border-line bg-asphalt-800 px-3 py-1.5 text-sm font-semibold text-ink ' +
  'transition-colors hover:border-signal hover:text-signal';

export function RelatedLinks({ groups }: { groups: RelatedLinkGroup[] }) {
  const filled = groups.filter((g) => g.links.length > 0);
  if (filled.length === 0) return null;
  return (
    <section className="mt-12" aria-label="Related directory pages">
      <h2 className="font-display text-2xl uppercase text-ink">Keep exploring</h2>
      <div className="mt-4 grid gap-5">
        {filled.map((g) => (
          <div key={g.heading}>
            <h3 className="text-sm font-semibold uppercase tracking-wide text-muted">
              {g.heading}
            </h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {g.links.map((l) => (
                <Link key={l.href + l.label} href={l.href} className={chip}>
                  {l.label}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/** The community links every directory page should carry. */
export const COMMUNITY_LINKS: RelatedLinkGroup = {
  heading: 'Driver community',
  links: [
    { href: '/directory/submit', label: 'Submit a location or correction' },
    { href: '/directory/reviews', label: 'Read & write driver reviews' },
  ],
};
