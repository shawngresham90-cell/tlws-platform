/**
 * Form constants shared by the public intake forms and their zod schemas.
 * Kept zod-free so client components can import the option lists without
 * pulling the whole validation library into the public bundle (perf audit #5).
 */

export const SUBMISSION_KINDS = [
  'new',
  'correction',
  'closure',
  'missing-info',
  'amenity-change',
] as const;
export type SubmissionKind = (typeof SUBMISSION_KINDS)[number];

export const TRUCK_TYPES = [
  'Dry van',
  'Reefer',
  'Flatbed',
  'Tanker',
  'Step deck',
  'Car hauler',
  'Box truck',
  'Other',
] as const;
