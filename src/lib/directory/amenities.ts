/**
 * THE single source of truth for directory amenity values.
 *
 * Pure constants with zero imports so it is safe in every context: the client
 * form renders its checkboxes from this list (each with value={amenity}), the
 * zod schema validates against it, the server action persists it, and the
 * database stores exactly these strings in locations.amenities (jsonb). Never
 * define an amenity list anywhere else.
 */
export const AMENITIES = [
  'Showers',
  'Food',
  'Fuel',
  'Laundry',
  'Restrooms',
  'Repair',
  'CAT Scale',
  'Wi-Fi',
  'Security',
] as const;

export type Amenity = (typeof AMENITIES)[number];
