import Link from 'next/link';

export type Feature = {
  title: string;
  description: string;
  href: string;
  cta?: string;
};

/**
 * Reusable card grid — the workhorse layout the Academy, Knowledge, Books, and
 * Apps sections all share. One component, consistent look, less code to maintain.
 */
export function FeatureGrid({
  features,
  columns = 3,
}: {
  features: Feature[];
  columns?: 2 | 3 | 4;
}) {
  const cols =
    columns === 2
      ? 'sm:grid-cols-2'
      : columns === 4
        ? 'sm:grid-cols-2 lg:grid-cols-4'
        : 'sm:grid-cols-3';
  return (
    <div className={`grid gap-5 ${cols}`}>
      {features.map((f) => (
        <Link
          key={f.title}
          href={f.href}
          className="placard lift group flex flex-col p-4 transition-colors hover:border-signal sm:p-6"
        >
          <h3 className="font-display text-xl uppercase text-signal">{f.title}</h3>
          <p className="mt-2 flex-1 text-sm text-muted">{f.description}</p>
          <span className="mt-4 text-sm font-semibold text-ink transition-transform group-hover:translate-x-1">
            {f.cta ?? 'Learn more'} →
          </span>
        </Link>
      ))}
    </div>
  );
}
