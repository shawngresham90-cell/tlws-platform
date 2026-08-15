import Image from 'next/image';
import Link from 'next/link';
import type { KcCategory } from '@/lib/kc/types';
import {
  categoryVisual,
  CATEGORY_BANNER_WIDTH,
  CATEGORY_BANNER_HEIGHT,
} from '@/lib/kc/category-visuals';

/**
 * A Knowledge Center category card, now with its banner as a thumbnail.
 *
 * The image is looked up by slug from lib/kc/category-visuals — the same
 * authority the category hero reads — so a card and its destination page can
 * never disagree about which photograph belongs to a category.
 *
 * The title and description stay real HTML below the image, not baked into it:
 * they come from the database row, they need to be selectable and searchable,
 * and the banner files carry no text of their own.
 *
 * `loading="lazy"` (next/image's default, made explicit) because this grid
 * sits below the fold on the landing page. The 16:9 box is reserved via
 * width/height so the row does not reflow as the six images arrive.
 *
 * A category with no approved artwork renders exactly as it did before —
 * text card, no gap, no broken frame.
 */
export function CategoryCard({ category }: { category: KcCategory }) {
  const visual = categoryVisual(category.slug);

  return (
    <Link
      href={`/knowledge/${category.slug}`}
      className="group flex flex-col overflow-hidden rounded-card border border-line bg-asphalt-800 transition-colors hover:border-signal"
    >
      {visual && (
        <div className="relative aspect-[16/9] w-full overflow-hidden border-b border-line">
          <Image
            src={visual.src}
            alt={visual.alt}
            width={CATEGORY_BANNER_WIDTH}
            height={CATEGORY_BANNER_HEIGHT}
            loading="lazy"
            sizes="(min-width: 1024px) 22rem, (min-width: 640px) 45vw, 100vw"
            className="h-full w-full object-cover"
            style={visual.objectPosition ? { objectPosition: visual.objectPosition } : undefined}
          />
        </div>
      )}
      <div className="flex flex-1 flex-col p-6">
        <h3 className="font-display text-xl uppercase text-signal">{category.name}</h3>
        {category.description && (
          <p className="mt-2 flex-1 text-sm text-muted">{category.description}</p>
        )}
        <span className="mt-4 text-sm font-semibold text-ink transition-transform group-hover:translate-x-1">
          Browse →
        </span>
      </div>
    </Link>
  );
}
