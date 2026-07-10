import Link from 'next/link';
import type { DirectoryCategory } from '@/lib/directory/types';
import { categoryHref } from '@/lib/directory/categories';

/**
 * Reusable grid of directory category cards — powers the /directory hub and
 * any future "browse other directories" blocks. Every category links to a real
 * page (the shared engine page or a custom one); no dead links.
 */
export function CategoryCardGrid({
  categories,
  headingLevel = 'h2',
}: {
  categories: DirectoryCategory[];
  /** Heading tag for card titles, so the grid nests correctly anywhere. */
  headingLevel?: 'h2' | 'h3';
}) {
  const Heading = headingLevel;
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      {categories.map((c) => (
        <Link
          key={c.slug}
          href={categoryHref(c)}
          className="group flex flex-col rounded-card border border-line bg-asphalt-800 p-6 transition-colors hover:border-signal"
        >
          <div
            aria-hidden="true"
            className="mb-4 flex aspect-[5/2] items-center justify-center rounded-card border border-line bg-asphalt-700 text-5xl"
          >
            {c.icon}
          </div>
          <Heading className="font-display text-xl uppercase text-signal">{c.title}</Heading>
          <p className="mt-2 flex-1 text-sm text-muted">{c.shortDescription}</p>
          <span className="mt-4 inline-flex self-start rounded-card bg-signal px-4 py-2 font-display text-sm uppercase text-asphalt transition-colors group-hover:bg-signal-600">
            Open directory →
          </span>
        </Link>
      ))}
    </div>
  );
}
