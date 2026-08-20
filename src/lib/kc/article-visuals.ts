import { SITE } from '@/lib/seo/site';

/**
 * The one authority for Knowledge Center ARTICLE visuals (KC-VIS-1).
 *
 * Articles live in Supabase (`kc_articles`), and the row already carries a
 * `hero_image_url` column — but every seeded article leaves it null, and a
 * URL in that column would render nowhere on the page anyway. The approved
 * article graphics are repository assets, exactly like the category banners,
 * so they follow the same doctrine as `category-visuals.ts`: ONE slug-keyed
 * mapping that every surface reads, so the inline figure, the Article
 * schema image, and the social-card image can never disagree about which
 * asset belongs to an article. No database migration, no renderer change.
 *
 * Precedence is explicit and lives in `articleImageUrl` below: a non-null
 * `hero_image_url` on the row always wins over this registry, so a future
 * DB-hosted hero can take over an article without touching this file.
 *
 * PENDING STATE. An article graphic ships only after the owner approves the
 * real artwork (same approval pipeline as the category banners — generated
 * frames are proposals until the owner signs off). Until then its spec waits
 * in `PENDING_ARTICLE_VISUALS`, which nothing renders: the article displays
 * exactly as it does today, metadata keeps the segment card, and the page
 * pays no cost for the empty slot. To promote a pending visual once its
 * approved files are committed:
 *
 *   1. Drop the approved WebP files at the exact paths the pending entry
 *      names (each ≤ 200 KB, dimensions exactly as declared).
 *   2. Move the entry from PENDING_ARTICLE_VISUALS into ARTICLE_VISUALS.
 *   3. Run `npm test` — scripts/test-kc-article-visuals.ts verifies the
 *      bytes, dimensions, budget, alt text, and heading anchor.
 *
 * ALT TEXT rule (same as the banners): describe what is literally in the
 * frame, never a bare label. For a diagram the alt must carry the
 * educational comparison itself — it is what a screen-reader user gets
 * instead of the graphic. Captions are verified facts only, and must add to
 * the alt rather than repeat it. The surrounding article text must state
 * every regulatory fact the graphic shows; the image is never the sole
 * source of a rule.
 */

export type ArticleVisualRendition = {
  /** Public path under ARTICLE_IMAGE_DIR. */
  src: string;
  /** Intrinsic pixel size of the committed file — must match the bytes. */
  width: number;
  height: number;
};

export type ArticleVisual = {
  /** The inline master, shown from the `sm` breakpoint up. */
  desktop: ArticleVisualRendition;
  /**
   * Optional art-directed rendition for narrow screens (below `sm`), for
   * graphics whose side-by-side composition would shrink illegibly on a
   * phone. When present the figure serves it via one `<picture>`, so the
   * browser downloads exactly one rendition.
   */
  mobile?: ArticleVisualRendition;
  /** Descriptive alt text carrying the comparison. Never a bare label. */
  alt: string;
  /** Optional verified-fact caption rendered as a real <figcaption>. */
  caption?: string;
  /**
   * The renderMarkdown heading id the figure follows (the article page
   * splits the rendered body immediately after that heading's closing tag).
   * Omitted or unmatched, the figure renders above the body instead — a
   * safety net; the harness pins the anchor so the fallback never ships.
   */
  afterHeadingId?: string;
};

/** Where every article graphic lives. */
export const ARTICLE_IMAGE_DIR = '/images/knowledge/articles/';

/** House performance budget per rendition (same ceiling as the banners). */
export const ARTICLE_VISUAL_MAX_BYTES = 200 * 1024;

/**
 * `category-slug/article-slug` → visual. Keyed by both slugs because article
 * slugs are only unique within a category.
 *
 * Only owner-approved artwork that is actually committed belongs here: the
 * harness validates every registered entry's bytes, dimensions, byte budget
 * and alt text, so registering an entry whose files are not on disk fails the
 * suite rather than shipping a broken frame.
 */
export const ARTICLE_VISUALS: Record<string, ArticleVisual> = {
  'getting-your-cdl/class-a-vs-class-b-cdl': {
    desktop: {
      src: `${ARTICLE_IMAGE_DIR}class-a-vs-class-b-cdl-comparison.webp`,
      width: 1600,
      height: 900,
    },
    mobile: {
      src: `${ARTICLE_IMAGE_DIR}class-a-vs-class-b-cdl-comparison-mobile.webp`,
      width: 1080,
      height: 1350,
    },
    alt:
      'Side-by-side diagram: a Class A CDL covers a combination — a tractor and trailer rated ' +
      '26,001 pounds or more together, with the trailer rated over 10,000 pounds — while a ' +
      'Class B CDL covers a single straight truck, such as a dump truck or box truck, rated ' +
      '26,001 pounds or more and towing no more than 10,000 pounds.',
    caption:
      'The trailer draws the line: Class A requires both thresholds — the combination’s rating ' +
      'and the towed unit’s rating (49 CFR 383.91).',
    afterHeadingId: 'class-a-vs-class-b-at-a-glance',
  },
};

/**
 * Approved SPECS awaiting owner-approved artwork. Nothing reads this at
 * runtime; the harness validates each spec's shape and heading anchor so the
 * promotion above is a file drop plus a one-line move.
 *
 * Empty today — the Class A vs Class B pair was promoted once its approved
 * artwork landed. The next article graphic queues here first.
 */
export const PENDING_ARTICLE_VISUALS: Record<string, ArticleVisual> = {};

/**
 * The visual for an article, or null when it has none. Null is the normal
 * state — every article without approved artwork renders exactly as before.
 * `Object.hasOwn` for the same reason as the category map: prototype keys
 * ("constructor", "toString") must miss, not resolve.
 */
export function articleVisual(categorySlug: string, articleSlug: string): ArticleVisual | null {
  const key = `${categorySlug}/${articleSlug}`;
  return Object.hasOwn(ARTICLE_VISUALS, key) ? ARTICLE_VISUALS[key] : null;
}

/**
 * The one image URL an article publishes everywhere — inline figure aside,
 * this exact value feeds `Article.image`, `og:image`, and `twitter:image`,
 * so the three can never point at different assets.
 *
 * Precedence: a non-null `hero_image_url` from the database row wins;
 * otherwise the registry visual's desktop master, made absolute against the
 * production origin (JSON-LD consumers do not resolve relative URLs).
 */
export function articleImageUrl(
  heroImageUrl: string | null,
  visual: ArticleVisual | null,
): string | undefined {
  if (heroImageUrl) return heroImageUrl;
  if (visual) return `${SITE.url}${visual.desktop.src}`;
  return undefined;
}

/**
 * Split rendered article HTML immediately after the closing tag of the
 * heading with the given id, so the figure can sit between the two halves
 * without the markdown renderer learning about images (deliberately out of
 * scope for KC-VIS-1). Returns null when no such heading exists; renderer
 * output is trusted, but both halves stay exactly the bytes renderMarkdown
 * produced — nothing is inserted INTO the HTML string itself.
 */
export function splitHtmlAfterHeading(
  html: string,
  headingId: string,
): { before: string; after: string } | null {
  const escaped = headingId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const heading = new RegExp(`<h([23]) id="${escaped}"[^>]*>[\\s\\S]*?</h\\1>`);
  const m = heading.exec(html);
  if (!m) return null;
  const cut = m.index + m[0].length;
  return { before: html.slice(0, cut), after: html.slice(cut) };
}
