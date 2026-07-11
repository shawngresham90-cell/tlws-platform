/**
 * Public detail-page slugs (Milestone 20). The database owns the canonical
 * value (locations.detail_slug, backfilled + insert trigger in migration 022);
 * these helpers mirror the SQL transform for the admin regeneration flow and
 * tests. Keep detailSlugBase() in sync with location_detail_slug_base().
 */

const MAX_BASE_LENGTH = 100;

/** Deterministic slug base from name + city + state: "pilot-travel-center-4558-dalton-ga". */
export function detailSlugBase(name: string, city: string, state: string): string {
  const base = `${name}-${city}-${state}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, MAX_BASE_LENGTH)
    .replace(/(^-|-$)+/g, '');
  return base || 'listing';
}

/** First slug not already taken: base, then base-2, base-3, … (matches the DB trigger). */
export function uniqueDetailSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/**
 * Route-param sanity check before the value ever reaches a query. Slugs are
 * generated lowercase-alphanumeric-hyphen; anything else can 404 without a
 * database round trip.
 */
export function isValidDetailSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{0,118}[a-z0-9])?$/.test(slug);
}

/** Public path for a listing's detail page. */
export function detailHref(detailSlug: string): string {
  return `/directory/location/${detailSlug}`;
}
