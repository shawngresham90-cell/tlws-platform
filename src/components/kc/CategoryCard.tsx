import Link from 'next/link';
import type { KcCategory } from '@/lib/kc/types';

export function CategoryCard({ category }: { category: KcCategory }) {
  return (
    <Link
      href={`/knowledge/${category.slug}`}
      className="group flex flex-col rounded-card border border-line bg-asphalt-800 p-6 transition-colors hover:border-signal"
    >
      <h3 className="font-display text-xl uppercase text-signal">{category.name}</h3>
      {category.description && (
        <p className="mt-2 flex-1 text-sm text-muted">{category.description}</p>
      )}
      <span className="mt-4 text-sm font-semibold text-ink transition-transform group-hover:translate-x-1">
        Browse →
      </span>
    </Link>
  );
}
