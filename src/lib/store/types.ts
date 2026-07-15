/**
 * Trucking Life Store — catalog types.
 *
 * A product is a curated EDITORIAL recommendation slot. Trucking Life writes
 * the honest, driver-facing case for each pick (what it's for, pros, cons,
 * Shawn's take). The Amazon-specific facts — ASIN, price, star rating, review
 * count, licensed image — are owner-supplied and stay NULL until verified.
 *
 * While those fields are null a product is in `placeholder` status: it renders
 * its editorial content and a disabled "Amazon link coming soon" button, and
 * shows NO price, NO rating, NO review count, and NO Amazon image. Nothing here
 * is ever guessed or scraped. Filling in the verified fields flips a product to
 * sellable — no code change required.
 */

export type StoreCategorySlug =
  | 'electronics'
  | 'comfort-sleep'
  | 'cab-kitchen'
  | 'safety-emergency'
  | 'tools-maintenance'
  | 'health-wellness'
  | 'apparel-gear';

/**
 * Finer-grained product type. Buying guides ("Best Dash Cams", etc.) are keyed
 * off these, while the 7 categories above drive the top-level browse.
 */
export type StoreProductType =
  | 'dash-cam'
  | 'cb-radio'
  | 'bluetooth-headset'
  | 'gps'
  | 'power-inverter'
  | 'charger'
  | 'organization'
  | 'fridge'
  | 'electric-skillet'
  | 'cab-cooking'
  | 'seat-cushion'
  | 'bedding'
  | 'dot-gear'
  | 'flashlight'
  | 'tools'
  | 'cleaning'
  | 'cpap'
  | 'health'
  | 'apparel'
  | 'atlas'
  | 'securement'
  | 'cab-comfort';

export type StoreProduct = {
  /** URL segment under /store/products/. */
  slug: string;
  /** Descriptive editorial archetype name — NOT a specific Amazon listing. */
  name: string;
  category: StoreCategorySlug;
  /** Finer product type (drives buying guides + related products). */
  productType: StoreProductType;
  /** One-line pitch shown on cards. */
  tagline: string;
  /** Longer why-a-driver-wants-this copy for the detail page. */
  description: string;
  /** 2–4 driver-relevant benefit bullets. */
  benefits: string[];
  /** Honest, type-level upsides (not tied to any unverified listing). */
  pros: string[];
  /** Honest, type-level trade-offs to weigh. */
  cons: string[];
  /** Shawn's plain-spoken recommendation / who it's for. */
  recommendation: string;
  /**
   * Verified Amazon product title, ONLY when owner-supplied. Overrides the
   * editorial name for display when set. REQUIRED (alongside a valid ASIN and a
   * licensed main image) for a product to activate. Optional/undefined until then.
   */
  verifiedTitle?: string | null;
  /**
   * Real Amazon ASIN. NULL for every placeholder — the owner fills this in.
   * A null ASIN means: no active Amazon button, no Offer schema, no price.
   */
  asin: string | null;
  /**
   * Price in whole US dollars, ONLY when the owner has confirmed the live
   * Amazon price. Never guessed. Null on placeholders.
   */
  priceUsd: number | null;
  /**
   * Amazon star rating (0–5), ONLY when owner-verified from the live listing.
   * Never fabricated. Null on placeholders.
   */
  rating: number | null;
  /**
   * Amazon review count, ONLY when owner-verified. Never fabricated. Null on
   * placeholders.
   */
  reviewCount: number | null;
  /**
   * Licensed image URL, ONLY when supplied. Amazon product images may not be
   * hot-linked without the Product Advertising API / license, so placeholders
   * use a branded icon tile instead.
   */
  imageUrl: string | null;
  /** Emoji used for the branded placeholder tile (never an Amazon asset). */
  icon: string;
  /** Show first on the store home / category top. */
  featured?: boolean;
};

/**
 * A product is sellable only when it has BOTH a valid ASIN and a confirmed
 * price. Rating, review count, and image are tracked for the catalog audit but
 * are not required to render an active affiliate link.
 */
export type ProductReadiness = {
  hasAsin: boolean;
  hasVerifiedTitle: boolean;
  hasPrice: boolean;
  hasRating: boolean;
  hasReviewCount: boolean;
  hasImage: boolean;
  /**
   * True once the product may activate: it has a valid ASIN, a verified title,
   * AND a licensed main image (price/rating/reviews are optional). This is what
   * gates the active Amazon button.
   */
  live: boolean;
  missing: string[];
};
