/**
 * The one authority for Knowledge Center category artwork.
 *
 * Categories themselves live in Supabase (`kc_categories`) — name, description
 * and slug all come from the database. The BANNER for each category is a
 * repository asset, so it cannot live in that row without a schema change, and
 * it must not be pasted into pages and cards separately: two literals for one
 * image is how a category quietly ends up showing the wrong photograph on the
 * landing page and the right one on its own page.
 *
 * The slug is the join key. Everything that renders a category visual — the
 * category hero, the landing cards, and anything added later — reads from
 * `categoryVisual(slug)` and nothing else.
 *
 * `scripts/test-kc-category-banners.ts` enforces the invariants: all six slugs
 * present, every asset on disk, real WebP container matching the extension,
 * 1672x941 for all six, no duplicate image paths, and no page hardcoding a
 * path of its own.
 *
 * ALT TEXT. Written to describe what is actually in each frame — these are the
 * words a screen-reader user gets instead of the picture, and a category name
 * repeated back ("Hours of Service banner") tells them nothing. No frame
 * carries readable signage or branding, so no alt text claims any.
 */

export type CategoryVisual = {
  /** Public path under /images/knowledge/categories. */
  src: string;
  /** Descriptive alt text. Never the bare category name. */
  alt: string;
  /**
   * CSS object-position, ONLY where a frame needs it. Every approved banner
   * places its subject right-of-centre with clean space on the left, which is
   * exactly what the hero's left-to-right scrim wants, so none currently
   * override the default. The field exists so a future frame with a different
   * composition can be corrected here rather than in a component.
   */
  objectPosition?: string;
};

/** Intrinsic size shared by all six approved banners. */
export const CATEGORY_BANNER_WIDTH = 1672;
export const CATEGORY_BANNER_HEIGHT = 941;

/**
 * Slug → visual. Keys are the live `kc_categories.slug` values.
 *
 * Note the deliberate absences: the Weather Driving frame is reserved for a
 * future article and is NOT a category banner, and the rejected frames (the
 * two-window classroom, the roadside shot containing a person) are not in the
 * repository at all.
 */
export const CATEGORY_VISUALS: Record<string, CategoryVisual> = {
  'dot-compliance': {
    src: '/images/knowledge/categories/dot-compliance.webp',
    alt: 'A blue semi-truck with a white trailer crossing the platform scale at a weigh station at dawn, green lane signal lit',
  },
  'hours-of-service': {
    src: '/images/knowledge/categories/hours-of-service.webp',
    alt: 'The empty cab of a parked truck at dusk, with an electronic logging device mounted on the dash',
  },
  'getting-your-cdl': {
    src: '/images/knowledge/categories/getting-your-cdl.webp',
    alt: 'A blue tractor and white trailer parked on a CDL practice range at sunrise, traffic cones marking the lane',
  },
  'cdl-training': {
    src: '/images/knowledge/categories/cdl-training.webp',
    alt: 'An empty CDL training classroom with rows of tables, a blank whiteboard and an instructor desk',
  },
  'trucking-careers': {
    src: '/images/knowledge/categories/trucking-careers.webp',
    alt: 'Three trucks parked at a freight terminal at sunset — a sleeper with a dry van, a day cab, and a tractor with a flatbed load',
  },
  'health-on-the-road': {
    src: '/images/knowledge/categories/health-on-the-road.webp',
    alt: 'An air fryer on the counter of a parked truck sleeper at night, a cooked ribeye steak in the open basket',
  },
};

/** The six slugs that must always have artwork. */
export const CATEGORY_SLUGS = Object.keys(CATEGORY_VISUALS);

/**
 * The visual for a slug, or null when a category has none.
 *
 * Returning null rather than a stand-in is deliberate: a new category added in
 * Supabase tomorrow has no approved photograph, and showing it someone else's
 * banner would be worse than showing it none. Both surfaces degrade to their
 * pre-banner layout when this returns null.
 */
export function categoryVisual(slug: string): CategoryVisual | null {
  return Object.hasOwn(CATEGORY_VISUALS, slug) ? CATEGORY_VISUALS[slug] : null;
}
