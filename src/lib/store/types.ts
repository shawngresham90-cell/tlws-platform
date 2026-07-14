/**
 * Trucking Life Store — catalog types.
 *
 * A product is a curated recommendation slot. Until the owner supplies the
 * real Amazon ASIN, price, and (licensed) image, a product stays in
 * `placeholder` status: it renders its name, category, and why-we-picked-it
 * copy, but shows NO active Amazon button, NO price, and NO Amazon image.
 * Filling in asin + price flips it to sellable — nothing else changes.
 */

export type StoreCategorySlug =
  | 'electronics'
  | 'comfort-sleep'
  | 'cab-kitchen'
  | 'safety-emergency'
  | 'tools-maintenance'
  | 'health-wellness'
  | 'apparel-gear';

export type StoreProduct = {
  /** URL segment under /store/products/. */
  slug: string;
  name: string;
  category: StoreCategorySlug;
  /** One-line pitch shown on cards. */
  tagline: string;
  /** Longer why-a-driver-wants-this copy for the detail page. */
  description: string;
  /** 2–4 driver-relevant benefit bullets. */
  benefits: string[];
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

/** A product is sellable only when it has BOTH a valid ASIN and a confirmed price. */
export type ProductReadiness = {
  hasAsin: boolean;
  hasPrice: boolean;
  hasImage: boolean;
  /** True once a real, clickable Amazon offer can be shown. */
  live: boolean;
  missing: string[];
};
