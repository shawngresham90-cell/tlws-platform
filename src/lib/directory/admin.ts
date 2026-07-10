import { z } from 'zod';
import { DIRECTORY_CATEGORIES } from './categories';
import { AMENITIES } from './amenities';

/**
 * Directory admin domain: the zod schema every write passes through, the
 * amenity vocabulary, slug generation, and the category-slug → locations.type
 * mapping (the legacy `type` column stays populated so migration-002
 * constraints and any older readers keep working).
 *
 * Shared by the admin server actions only — nothing here touches the browser.
 */

// Re-exported so existing imports keep working; the list itself lives in
// lib/directory/amenities.ts (shared with the client form — do not duplicate).
export { AMENITIES } from './amenities';

export const CATEGORY_SLUGS = DIRECTORY_CATEGORIES.map((c) => c.slug) as [string, ...string[]];

/** locations.type for a category slug (registry is the source of truth). */
export function dbTypeFor(categorySlug: string): string {
  return DIRECTORY_CATEGORIES.find((c) => c.slug === categorySlug)?.dbType ?? 'other';
}

/** URL-safe slug from a listing name. */
export function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '')
      .slice(0, 80) || 'listing'
  );
}

/** http(s)-only URL — rejects javascript:, data:, protocol-relative, etc. */
const httpUrl = z
  .string()
  .trim()
  .max(300)
  .refine(
    (v) => {
      try {
        const u = new URL(v);
        return u.protocol === 'http:' || u.protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'Must be a full http(s):// URL' },
  );

/** Empty form fields arrive as '' — treat as absent. */
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema.optional());

export const listingSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  category_slug: z
    .string()
    .refine((v) => (CATEGORY_SLUGS as string[]).includes(v), 'Pick a category'),
  address: optional(z.string().trim().max(200)),
  city: z.string().trim().min(1, 'City is required').max(80),
  state: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'State must be a 2-letter code'),
  zip: optional(z.string().trim().regex(/^\d{5}(-\d{4})?$/, 'ZIP must be 12345 or 12345-6789')),
  lat: optional(z.coerce.number().min(-90).max(90)),
  lng: optional(z.coerce.number().min(-180).max(180)),
  phone: optional(
    z
      .string()
      .trim()
      .max(30)
      .regex(/^[0-9()+.\-\s ext]*$/i, 'Phone can only contain digits and ()+-. '),
  ),
  website: optional(httpUrl),
  description: optional(z.string().trim().max(2000)),
  free_parking: z.boolean(),
  paid_parking: z.boolean(),
  reserved_parking: z.boolean(),
  overnight_parking: z.boolean(),
  parking_spaces: optional(z.coerce.number().int().min(0).max(10000)),
  amenities: z
    .array(z.string())
    .max(AMENITIES.length)
    .refine((arr) => arr.every((a) => (AMENITIES as readonly string[]).includes(a)), {
      message: 'Unknown amenity',
    }),
  tpc_url: optional(httpUrl),
  affiliate_code: optional(
    z.string().trim().max(60).regex(/^[\w-]+$/, 'Letters, numbers, - and _ only'),
  ),
  image_url: optional(httpUrl),
  is_published: z.boolean(),
  is_featured: z.boolean(),
  is_indexable: z.boolean(),
  verified_on: optional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date picker')),
});

export type ListingInput = z.infer<typeof listingSchema>;

/** FormData → validated input, or a single human-readable error string. */
export function parseListingForm(
  formData: FormData,
): { data: ListingInput; error?: undefined } | { data?: undefined; error: string } {
  const bool = (k: string) => formData.get(k) === 'on';
  const raw = {
    name: formData.get('name') ?? '',
    category_slug: formData.get('category_slug') ?? '',
    address: formData.get('address') ?? '',
    city: formData.get('city') ?? '',
    state: formData.get('state') ?? '',
    zip: formData.get('zip') ?? '',
    lat: formData.get('lat') ?? '',
    lng: formData.get('lng') ?? '',
    phone: formData.get('phone') ?? '',
    website: formData.get('website') ?? '',
    description: formData.get('description') ?? '',
    free_parking: bool('free_parking'),
    paid_parking: bool('paid_parking'),
    reserved_parking: bool('reserved_parking'),
    overnight_parking: bool('overnight_parking'),
    parking_spaces: formData.get('parking_spaces') ?? '',
    amenities: formData.getAll('amenities').map(String),
    tpc_url: formData.get('tpc_url') ?? '',
    affiliate_code: formData.get('affiliate_code') ?? '',
    image_url: formData.get('image_url') ?? '',
    is_published: bool('is_published'),
    is_featured: bool('is_featured'),
    is_indexable: bool('is_indexable'),
    verified_on: formData.get('verified_on') ?? '',
  };

  const parsed = listingSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    const field = first.path.join('.') || 'form';
    return { error: `${field}: ${first.message}` };
  }
  return { data: parsed.data };
}

/** Validated input → the locations row the service-role client writes. */
export function toRow(input: ListingInput) {
  return {
    name: input.name,
    category_slug: input.category_slug,
    type: dbTypeFor(input.category_slug),
    address: input.address ?? null,
    city: input.city,
    state: input.state,
    zip: input.zip ?? null,
    lat: input.lat ?? null,
    lng: input.lng ?? null,
    phone: input.phone ?? null,
    website: input.website ?? null,
    description: input.description ?? null,
    free_parking: input.free_parking,
    paid_parking: input.paid_parking,
    reserved_parking: input.reserved_parking,
    overnight_parking: input.overnight_parking,
    parking_spaces: input.parking_spaces ?? null,
    amenities: input.amenities,
    tpc_url: input.tpc_url ?? null,
    affiliate_code: input.affiliate_code ?? null,
    image_url: input.image_url ?? null,
    is_published: input.is_published,
    is_featured: input.is_featured,
    is_indexable: input.is_indexable,
    verified_at: input.verified_on ? new Date(`${input.verified_on}T00:00:00Z`).toISOString() : null,
  };
}
