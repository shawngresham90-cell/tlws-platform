/**
 * Directory Engine types (Milestone 11).
 *
 * DirectoryEntry deliberately mirrors the `public.locations` table shaped in
 * migration 002 (name/state/city/slug/address/phone/website/amenities/…), so
 * when the database milestone lands, rows map 1:1 onto what the UI already
 * renders — the swap happens in the data layer, not in components.
 */

export type DirectoryEntry = {
  id: string;
  /** Directory category slug this entry belongs to (see categories.ts). */
  category: string;
  name: string;
  /** Two-letter state code, e.g. "GA". */
  state: string;
  city: string;
  slug: string;
  address?: string;
  zip?: string;
  phone?: string;
  website?: string;
  /** Short amenity/tag labels rendered as chips, e.g. "Overnight OK", "Showers". */
  amenities?: string[];
  parkingSpaces?: number;
  description?: string;
  /** Validated https URL to reserve this spot on TruckParkingClub (affiliate). */
  tpcUrl?: string;
  featured?: boolean;
  /** Complete enough for SEO surfaces (schema, indexing). Set in the admin. */
  indexable?: boolean;
  lat?: number;
  lng?: number;
  /** Highway designation, e.g. "I-75" (searchable). */
  interstate?: string;
  /** Exit number — future-ready for exit-based navigation. */
  exitNumber?: string;
  /** ISO timestamp, powers the "Newest" sort. */
  createdAt?: string;
  /** Globally unique slug for /directory/location/[slug] (migration 022). */
  detailSlug?: string;
  /** ISO timestamp of the last change — dateModified on detail pages. */
  updatedAt?: string;
  /** ISO timestamp the listing was last verified by the admin, when set. */
  verifiedAt?: string;
};

export type DirectoryCategory = {
  /** URL segment under /directory/. */
  slug: string;
  title: string;
  /** Emoji used on cards (matches the existing hub's visual language). */
  icon: string;
  /** One-liner for the hub card. */
  shortDescription: string;
  /** <title> for the category page. */
  seoTitle: string;
  /** Meta description for the category page. */
  seoDescription: string;
  heroTitle: string;
  heroIntro: string;
  /**
   * Future `locations.type` this category reads from — documents the DB
   * mapping now so the database milestone doesn't have to rediscover it.
   */
  dbType:
    | 'truck_stop'
    | 'rest_area'
    | 'weigh_station'
    | 'parking'
    | 'repair'
    | 'cdl_school'
    | 'other';
  /**
   * Set when the category has its own hand-built page instead of the shared
   * engine page (Truck Parking's foundation page). The hub links here and the
   * engine's [category] route does NOT claim this slug.
   */
  customHref?: string;
};
