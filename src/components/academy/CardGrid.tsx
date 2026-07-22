import Link from 'next/link';

export type Card = {
  title: string;
  description: React.ReactNode;
  /** Optional link — when present the whole card becomes a link with a CTA arrow. */
  href?: string;
  cta?: string;
  /** Optional emoji/icon glyph rendered above the title. */
  icon?: string;
};

/**
 * Content card grid for the Academy. Like the site's FeatureGrid, but each card
 * may be a plain info card (no link) or a linked card — so one component covers
 * both "here's a fact" and "here's where to go next."
 */
export function CardGrid({ cards, columns = 3 }: { cards: Card[]; columns?: 2 | 3 | 4 }) {
  const cols =
    columns === 2
      ? 'sm:grid-cols-2'
      : columns === 4
        ? 'sm:grid-cols-2 lg:grid-cols-4'
        : 'sm:grid-cols-2 lg:grid-cols-3';

  return (
    <div className={`grid gap-5 ${cols}`}>
      {cards.map((c) => {
        const inner = (
          <>
            {c.icon && (
              <span className="text-2xl" aria-hidden="true">
                {c.icon}
              </span>
            )}
            <h3 className="mt-2 font-display text-xl uppercase text-signal">{c.title}</h3>
            <div className="mt-2 flex-1 text-sm text-muted">{c.description}</div>
            {c.href && (
              <span className="mt-4 text-sm font-semibold text-ink transition-transform group-hover:translate-x-1">
                {c.cta ?? 'Learn more'} →
              </span>
            )}
          </>
        );

        const base = 'placard flex flex-col p-4 sm:p-6';

        return c.href ? (
          <Link
            key={c.title}
            href={c.href}
            className={`group ${base} lift transition-colors hover:border-signal`}
          >
            {inner}
          </Link>
        ) : (
          <div key={c.title} className={base}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}
