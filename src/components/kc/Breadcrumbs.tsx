import Link from 'next/link';

export type Crumb = { name: string; href?: string };

/** Visible breadcrumb trail. Pairs with breadcrumbSchema for the JSON-LD side. */
export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav aria-label="Breadcrumb" className="mb-6">
      <ol className="flex flex-wrap items-center gap-2 text-xs text-muted">
        {crumbs.map((c, i) => (
          <li key={i} className="flex items-center gap-2">
            {c.href ? (
              <Link href={c.href} className="uppercase tracking-wide hover:text-signal">
                {c.name}
              </Link>
            ) : (
              <span className="uppercase tracking-wide text-ink" aria-current="page">
                {c.name}
              </span>
            )}
            {i < crumbs.length - 1 && <span aria-hidden="true">/</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}
