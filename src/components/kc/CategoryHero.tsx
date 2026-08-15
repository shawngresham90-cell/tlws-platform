import Image from 'next/image';
import { Container, Eyebrow } from '@/components/ui';
import { Breadcrumbs } from '@/components/kc/Breadcrumbs';
import { SearchBox } from '@/components/kc/SearchBox';
import { categoryVisual } from '@/lib/kc/category-visuals';

/**
 * The Knowledge Center category header, with its banner behind the title.
 *
 * Replaces the plain heading block that used to sit at the top of every
 * category page. Name and description still come from the database row; only
 * the artwork is new, and it is looked up by slug from lib/kc/category-visuals
 * rather than passed in, so no caller can supply a mismatched image.
 *
 * ACCESSIBILITY / LAYOUT decisions, all load-bearing:
 *
 * - ONE `<h1>`. The page previously had exactly one and still does; this
 *   component owns it, and the page must not render another.
 *
 * - The banner is decorative HERE, so `alt=""` and `aria-hidden`. The heading
 *   beside it already names the category, and the descriptive alt text from
 *   the mapping is used on the landing cards where the image IS the link's
 *   content. Announcing a long scene description immediately before an `<h1>`
 *   that says the same thing is noise for a screen reader.
 *
 * - The band's height comes from the copy inside it, and the image `fill`s that
 *   band with `object-cover`. The image's own 16:9 ratio is never distorted;
 *   the band is a letterbox crop of it. A true 16:9 hero would be 720px tall
 *   at desktop width and would push the articles — the point of the page —
 *   below the fold, so the band stays roughly the height of the plain heading
 *   block it replaced. Because the height is set by the text, the box is
 *   reserved before the image loads and nothing shifts.
 *
 * - The scrims are per-breakpoint, and deliberately NOT stacked. From `sm` the
 *   copy occupies the left half, so a left-to-right gradient darkens exactly
 *   where the text sits and clears over the subject on the right. Below `sm`
 *   the copy spans the full width, so a bottom-up gradient does the work
 *   instead. Running both at once multiplies to near-black and wastes the
 *   photograph — that was the first version of this component.
 *
 * - `object-position` shifts right below `sm`. The band is much taller than
 *   16:9 on a phone, so `object-cover` scales to the height and crops the
 *   sides; a centred crop cuts off the subject, which every approved frame
 *   places right-of-centre. A per-frame `objectPosition` from the mapping
 *   still overrides this at every width.
 *
 * - `priority` on the image: this is the LCP element of the page.
 */
export function CategoryHero({
  slug,
  name,
  description,
}: {
  slug: string;
  name: string;
  description?: string | null;
}) {
  const visual = categoryVisual(slug);

  return (
    <div className="relative isolate border-b border-line bg-asphalt">
      {visual && (
        <div aria-hidden="true" className="absolute inset-0 -z-10 overflow-hidden">
          <Image
            src={visual.src}
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover object-[72%_50%] sm:object-center"
            style={visual.objectPosition ? { objectPosition: visual.objectPosition } : undefined}
          />
          {/* sm and up: left-to-right scrim — opaque where the title sits,
              clear over the subject on the right. */}
          <div
            className="absolute inset-0 hidden sm:block"
            style={{
              background:
                'linear-gradient(90deg, rgba(20,20,20,0.95) 0%, rgba(20,20,20,0.92) 35%, rgba(20,20,20,0.84) 62%, rgba(20,20,20,0.44) 80%, rgba(20,20,20,0.24) 100%)',
            }}
          />
          {/* Below sm: bottom-up scrim only, sized to carry the copy without
              blacking out the frame. */}
          <div
            className="absolute inset-0 sm:hidden"
            style={{
              background:
                'linear-gradient(0deg, rgba(20,20,20,0.94) 0%, rgba(20,20,20,0.89) 45%, rgba(20,20,20,0.62) 76%, rgba(20,20,20,0.32) 100%)',
            }}
          />
        </div>
      )}

      {/* Compact on purpose — the articles are the point of the page, so the
          hero stays roughly the height of the block it replaced. */}
      <Container className="py-12 sm:py-16">
        <Breadcrumbs
          crumbs={[
            { name: 'Home', href: '/' },
            { name: 'Knowledge Center', href: '/knowledge' },
            { name },
          ]}
        />
        <Eyebrow>Knowledge Center</Eyebrow>
        <h1 className="display-hero max-w-3xl text-4xl sm:text-5xl">{name}</h1>
        {description && <p className="mt-4 max-w-2xl text-lg text-muted">{description}</p>}
        <div className="mt-8">
          <SearchBox />
        </div>
      </Container>
    </div>
  );
}
