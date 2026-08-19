import Image, { getImageProps } from 'next/image';
import type { CSSProperties } from 'react';
import type { ArticleVisual } from '@/lib/kc/article-visuals';

/**
 * A Knowledge Center article graphic, rendered inside the article column.
 *
 * Deliberately NOT `CinematicStill`: that component is the treatment for
 * documentary PHOTOGRAPHY — sodium grade, film grain, and a bottom-third
 * scrim carrying overlay caption text. Every one of those would damage a
 * diagram: the grade shifts the amber the graphic uses to mark a threshold,
 * and an overlay caption sits exactly on top of the labels the reader came
 * for. Same reasoning already recorded for the Academy training-fleet photo
 * (the frame is brand, the artwork is untouched) — here the caption also
 * moves BELOW the frame, where it can be read at 360px without covering
 * anything.
 *
 * Server component: no 'use client', no state, no effects, no third-party
 * script. `getImageProps` runs at render time and the output is a plain
 * `<picture>`, so an art-directed graphic costs zero client JavaScript —
 * the same path the homepage hero uses.
 *
 * NO LAYOUT SHIFT, both paths:
 * - one rendition → plain `next/image` with the real intrinsic width/height
 *   and `h-auto w-full`, which reserves the box from the ratio before the
 *   bytes arrive (the training-fleet pattern);
 * - two renditions → the frame reserves each rendition's own aspect through
 *   `.kc-figure-frame` and the two custom properties below, because a
 *   16:9 master and a 4:5 phone frame cannot share one width/height pair.
 *
 * The image lazy-loads (no `priority`): every registered figure sits below
 * a heading partway down the body, never in the first viewport, so eager
 * loading here would compete with the page's real LCP element for bandwidth.
 *
 * ALT is required by the registry type and passed straight through — for a
 * diagram it carries the comparison itself. The caption is a separate real
 * `<figcaption>`, so a screen reader gets the description and the caption as
 * distinct text rather than one duplicated blob.
 */

/**
 * The article column is `max-w-3xl` (768px) inside a Container whose padding
 * is 20px, then 32px from `sm` — so 832px viewport is where the column stops
 * growing and pins at 768px.
 */
const SIZES = '(min-width: 832px) 768px, 100vw';

/**
 * The art-direction breakpoint. Must stay identical to the `.kc-figure-frame`
 * media query in globals.css — the source picked and the box reserved have to
 * flip at the same width.
 */
const DESKTOP_MEDIA = '(min-width: 640px)';

const FRAME =
  'relative overflow-hidden rounded-card border border-line bg-asphalt-800 ' +
  'shadow-lg shadow-black/40';

export function ArticleFigure({
  visual,
  className,
}: {
  visual: ArticleVisual;
  className?: string;
}) {
  const { desktop, mobile, alt, caption } = visual;

  return (
    <figure className={className ?? 'my-10'}>
      {mobile ? (
        <ArtDirectedFrame visual={visual} />
      ) : (
        <div className={FRAME}>
          <Image
            src={desktop.src}
            alt={alt}
            width={desktop.width}
            height={desktop.height}
            loading="lazy"
            sizes={SIZES}
            className="h-auto w-full"
          />
        </div>
      )}
      {caption && (
        // Below the frame, not over it, and at text-sm rather than the 11px
        // uppercase `doc-caption` voice: this caption is a full factual
        // sentence with a regulation citation, and uppercase 11px is a label
        // treatment that becomes genuinely hard to read at 360px. muted on
        // asphalt measures ~7.4:1, well clear of the AA floor.
        <figcaption className="mt-3 text-sm leading-relaxed text-muted">{caption}</figcaption>
      )}
    </figure>
  );
}

/**
 * Two renditions, one `<picture>`, one download. The browser picks the
 * source before it fetches anything, so a phone never pays for the desktop
 * master (or the reverse).
 */
function ArtDirectedFrame({ visual }: { visual: ArticleVisual }) {
  const { desktop, mobile, alt } = visual;
  if (!mobile) return null;

  const { props: desktopProps } = getImageProps({
    alt,
    src: desktop.src,
    width: desktop.width,
    height: desktop.height,
    sizes: SIZES,
  });
  const { props: mobileProps } = getImageProps({
    alt,
    src: mobile.src,
    width: mobile.width,
    height: mobile.height,
    sizes: SIZES,
  });

  // The frame's reserved shape per breakpoint, from the real intrinsic
  // dimensions rather than a hand-written ratio that could drift from the
  // committed files.
  const frameStyle = {
    '--kc-figure-ratio-mobile': `${mobile.width} / ${mobile.height}`,
    '--kc-figure-ratio-desktop': `${desktop.width} / ${desktop.height}`,
  } as CSSProperties;

  return (
    <div className={`${FRAME} kc-figure-frame`} style={frameStyle}>
      <picture>
        <source media={DESKTOP_MEDIA} srcSet={desktopProps.srcSet} sizes={desktopProps.sizes} />
        {/* eslint-disable-next-line @next/next/no-img-element -- art direction
            needs a real <picture>; next/image cannot switch sources by media
            query. Same construction as the homepage hero. */}
        <img
          {...mobileProps}
          alt={alt}
          loading="lazy"
          decoding="async"
          // object-CONTAIN, not cover: the frame's ratio is computed from
          // these exact dimensions so the two always agree and nothing is
          // letterboxed — but if a committed file ever drifted from its
          // declared size, contain shows the whole diagram while cover would
          // silently slice a label off its edge.
          className="absolute inset-0 h-full w-full object-contain"
        />
      </picture>
    </div>
  );
}
