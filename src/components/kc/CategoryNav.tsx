import Link from 'next/link';
import type { KcCategory } from '@/lib/kc/types';

/** Horizontal category nav used across KC pages. Highlights the active one. */
export function CategoryNav({
  categories,
  activeSlug,
}: {
  categories: KcCategory[];
  activeSlug?: string;
}) {
  return (
    <nav aria-label="Knowledge Center categories" className="mb-10 border-b border-line pb-4">
      <ul className="flex flex-wrap gap-x-6 gap-y-2">
        <li>
          <Link
            href="/knowledge"
            className={`text-sm font-semibold uppercase tracking-wide ${!activeSlug ? 'text-signal' : 'text-muted hover:text-signal'}`}
          >
            All
          </Link>
        </li>
        {categories.map((c) => (
          <li key={c.id}>
            <Link
              href={`/knowledge/${c.slug}`}
              className={`text-sm font-semibold uppercase tracking-wide ${activeSlug === c.slug ? 'text-signal' : 'text-muted hover:text-signal'}`}
            >
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
