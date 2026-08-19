import { getImageProps } from 'next/image';
import type { ArticleVisual } from '@/lib/kc/article-visuals';

/**
 * A curated diagram inside a Knowledge Center article.
 *
 * Semantic `<figure>`/`<figcaption>`, because the picture is referenced by the
 * prose around it rather than being decoration — and the caption is a real
 * caption, not a repeat of the alt text. A screen reader gets the alt (what
 * the diagram compares); a sighted reader gets the caption (why it matters).
 * Saying the same sentence twice would just make the page longer for the
 * people who can least afford it.
 *
 * ART DIRECTION. A 16:9 comparison that works on a laptop is unreadable at
 * 360px, so a portrait rendition can be supplied for narrow screens. This is a
 * real `<picture>` rather than two images toggled with CSS, because
 * `display:none` does not stop a download — the phone would pay for the
 * desktop file it never shows. `getImageProps` gives the optimized srcSet
 * next/image would have produced, and the browser picks exactly one source.
 *
 * NO LAYOUT SHIFT. Both renditions carry their intrinsic width/height, so the
 * box is reserved before the bytes arrive; `<source>` carries them too, so the
 * reserved box matches whichever rendition wins. The figure is below the fold
 * in every registered placement, so it lazy-loads and never competes with the
 * article's own LCP element.
 *
 * The image is additive. If it fails to load, the comparison it illustrates is
 * still in the HTML immediately above and below this figure.
 */
export function ArticleFigure({ visual }: { visual: ArticleVisual }) {
  const shared = {
    alt: visual.alt,
    // The article column is max-w-3xl (48rem); below that the figure is the
    // full column width minus the page gutters.
    sizes: '(min-width: 768px) 48rem, 100vw',
    loading: 'lazy' as const,
  };

  const { props: desktop } = getImageProps({
    ...shared,
    src: visual.src,
    width: visual.width,
    height: visual.height,
  });

  const mobile =
    visual.mobileSrc && visual.mobileWidth && visual.mobileHeight
      ? getImageProps({
          ...shared,
          src: visual.mobileSrc,
          width: visual.mobileWidth,
          height: visual.mobileHeight,
        }).props
      : null;

  return (
    <figure className="my-8">
      <picture>
        {mobile && (
          <source
            media="(max-width: 639px)"
            srcSet={mobile.srcSet}
            sizes={mobile.sizes}
            width={visual.mobileWidth}
            height={visual.mobileHeight}
          />
        )}
        {/* eslint-disable-next-line jsx-a11y/alt-text -- alt comes from getImageProps */}
        <img
          {...desktop}
          decoding="async"
          className="h-auto w-full rounded-card border border-line bg-asphalt-800"
        />
      </picture>
      {visual.caption && (
        <figcaption className="mt-3 text-sm leading-relaxed text-muted">
          {visual.caption}
        </figcaption>
      )}
    </figure>
  );
}
