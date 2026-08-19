/**
 * The one authority for Knowledge Center ARTICLE artwork.
 *
 * Categories already have this (lib/kc/category-visuals); articles did not.
 * The Knowledge Center renderer is deliberately text-oriented — it supports
 * headings, links, bold, and lists, and nothing else — so an article could
 * not show a diagram at all without either loosening the renderer or pasting
 * image paths into pages. Both are worse than this: loosening the renderer
 * lets arbitrary remote images into database-authored content, and pasting
 * paths creates the same two-literals-one-image problem the category banners
 * were built to avoid.
 *
 * So curated article visuals live here, keyed by `kc_articles.slug`, and
 * every surface that renders or references one — the article body, the
 * Article schema image, Open Graph, Twitter — reads from this module.
 *
 * PENDING vs READY. A visual is registered before its artwork exists, so the
 * placement, alt text, caption and asset contract can be reviewed and pinned
 * in CI while the image is still being produced. `status: 'pending'` means
 * "the contract is agreed, the file is not here yet": the article renders
 * exactly as it does today, and NOTHING references the missing file — not the
 * body, not the metadata, not the schema. `status: 'ready'` means the asset
 * must exist on disk and satisfy every dimension, format and weight rule in
 * scripts/test-kc-article-visuals.ts. That split is the whole point: a
 * deliberately pending asset is a normal state, a registered-but-broken one
 * fails the build.
 *
 * PLACEMENT. `afterHeadingId` is the slugified id the markdown renderer gives
 * a heading (see lib/kc/mdx). The figure is inserted immediately after that
 * heading, so it supplements the prose under it. If the heading ever moves or
 * is renamed the id stops resolving and the article renders without the
 * figure rather than dropping it somewhere arbitrary — and CI catches the
 * drift, because the anchor is asserted against the seeded article body.
 *
 * The graphic NEVER carries a regulatory fact alone. Every threshold it shows
 * is already stated in the HTML above and below it; the picture is a second
 * encoding of the same source-cited text, for the readers who need one.
 */

export type ArticleVisualStatus = 'ready' | 'pending';

export type ArticleVisual = {
  /**
   * 'pending' until the artwork lands. Pending visuals are registered (so the
   * contract is reviewable and CI-pinned) but never rendered or referenced.
   */
  status: ArticleVisualStatus;
  /** Public path of the primary (desktop) rendition. Repo-local. */
  src: string;
  /** Intrinsic size of the primary rendition — reserves the box, no CLS. */
  width: number;
  height: number;
  /** Optional art-directed portrait rendition for narrow screens. */
  mobileSrc?: string;
  mobileWidth?: number;
  mobileHeight?: number;
  /**
   * What the picture actually shows and compares — this is what a screen
   * reader gets instead of the diagram, so it states the comparison rather
   * than naming the file's subject.
   */
  alt: string;
  /** Optional visible caption. Complements the alt; never repeats it. */
  caption?: string;
  /** Heading id (from the markdown renderer) the figure is placed after. */
  afterHeadingId: string;
};

/** Weight ceiling per rendition. Diagrams this simple have no excuse to exceed it. */
export const ARTICLE_VISUAL_MAX_BYTES = 200 * 1024;

/**
 * Article slug → visual.
 *
 * One entry today. The Class A vs Class B comparison is the proof case: it is
 * the page whose central section is a six-row threshold comparison, which is
 * exactly the content that reads better as a diagram on a phone — and its
 * regulatory facts are already carried by the list itself, so the graphic can
 * be additive rather than load-bearing.
 */
export const ARTICLE_VISUALS: Record<string, ArticleVisual> = {
  'class-a-vs-class-b-cdl': {
    status: 'pending',
    src: '/images/knowledge/articles/class-a-vs-class-b-cdl-comparison.webp',
    width: 1600,
    height: 900,
    mobileSrc: '/images/knowledge/articles/class-a-vs-class-b-cdl-comparison-mobile.webp',
    mobileWidth: 1080,
    mobileHeight: 1350,
    alt: 'Side-by-side diagram comparing the two CDL vehicle groups: on the left a Class A tractor coupled to a semi-trailer, marked 26,001 pounds or more combined with a towed unit over 10,000 pounds; on the right a Class B straight truck, marked a single vehicle of 26,001 pounds or more towing 10,000 pounds or less',
    caption: 'The towed unit is the dividing line between the two vehicle groups.',
    afterHeadingId: 'class-a-vs-class-b-at-a-glance',
  },
};

/** Every registered slug, including pending ones — for CI, not for rendering. */
export const ARTICLE_VISUAL_SLUGS = Object.keys(ARTICLE_VISUALS);

/**
 * The registry entry for a slug whatever its status, or null.
 *
 * For validation and tooling only. Rendering and metadata must use
 * `articleVisual`, which withholds pending entries.
 */
export function registeredArticleVisual(slug: string): ArticleVisual | null {
  return Object.hasOwn(ARTICLE_VISUALS, slug) ? ARTICLE_VISUALS[slug] : null;
}

/**
 * The RENDERABLE visual for a slug, or null.
 *
 * Null for an unknown slug and null for a pending one — a caller cannot
 * accidentally render, link, or advertise artwork that does not exist yet.
 */
export function articleVisual(slug: string): ArticleVisual | null {
  const visual = registeredArticleVisual(slug);
  return visual && visual.status === 'ready' ? visual : null;
}

/**
 * The absolute URL of an article's primary visual, or null.
 *
 * This is the single image authority for Article schema, Open Graph and
 * Twitter. It returns the same asset the body renders inline, so the picture
 * a crawler is told about is the picture a reader sees — absolute because
 * JSON-LD is consumed away from the page that served it.
 *
 * `siteUrl` is passed in rather than imported so this module stays free of
 * SEO-config coupling and is trivially testable.
 */
export function articleVisualImageUrl(slug: string, siteUrl: string): string | null {
  const visual = articleVisual(slug);
  return visual ? `${siteUrl}${visual.src}` : null;
}
