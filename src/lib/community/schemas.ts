import { z } from 'zod';
import { CATEGORY_SLUGS } from '@/lib/directory/admin';
import { AMENITIES } from '@/lib/directory/amenities';

/**
 * Driver community validation (Milestone 16) — the zod contracts for the two
 * public intake routes. Everything that passes these schemas lands in a
 * moderation table with status 'pending'; nothing here can publish content.
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

/** Empty strings from form fields count as absent. */
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema.optional());

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
    { message: 'Website must be a full http(s):// URL.' },
  );

/**
 * Honeypot: a field human users never see (hidden via CSS). Any value means a
 * bot filled the form — the route pretends success and drops the payload.
 */
const honeypot = z.string().max(200).optional().default('');

export const submissionSchema = z
  .object({
    kind: z.enum(SUBMISSION_KINDS),
    // The existing listing this refers to; required for every kind except 'new'.
    location_id: optional(z.string().uuid('Pick a listing from the list.')),
    name: z.string().trim().min(2, 'Enter the business name.').max(120),
    category_slug: optional(
      z.string().refine((v) => (CATEGORY_SLUGS as string[]).includes(v), 'Pick a category.'),
    ),
    address: optional(z.string().trim().max(200)),
    city: optional(z.string().trim().max(80)),
    state: optional(
      z
        .string()
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{2}$/, 'State must be a 2-letter code.'),
    ),
    zip: optional(z.string().trim().regex(/^\d{5}(-\d{4})?$/, 'ZIP must be 12345 or 12345-6789.')),
    phone: optional(
      z
        .string()
        .trim()
        .max(30)
        .regex(/^[0-9()+.\-\s ext]*$/i, 'Phone can only contain digits and ()+-. '),
    ),
    website: optional(httpUrl),
    description: optional(z.string().trim().max(2000)),
    amenities: z
      .array(z.string())
      .max(AMENITIES.length)
      .refine((arr) => arr.every((a) => (AMENITIES as readonly string[]).includes(a)), {
        message: 'Unknown amenity.',
      })
      .default([]),
    // Tri-state on purpose: null = "didn't say", distinct from yes/no.
    free_parking: z.boolean().nullable().default(null),
    paid_parking: z.boolean().nullable().default(null),
    reserved_parking: z.boolean().nullable().default(null),
    overnight_parking: z.boolean().nullable().default(null),
    parking_spaces: optional(z.coerce.number().int().min(0).max(10000)),
    comments: optional(z.string().trim().max(2000)),
    submitter_name: optional(z.string().trim().max(80)),
    submitter_contact: optional(z.string().trim().max(200)),
    company_website: honeypot,
    turnstileToken: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.kind !== 'new' && !data.location_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['location_id'],
        message: 'Pick the listing this report is about.',
      });
    }
    if (data.kind === 'new' && !data.category_slug) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['category_slug'],
        message: 'Pick a category for the new location.',
      });
    }
  });

export type SubmissionInput = z.infer<typeof submissionSchema>;

export const reviewSchema = z.object({
  location_id: z.string().uuid('Pick a listing from the list.'),
  rating: z.coerce.number().int().min(1, 'Pick a star rating.').max(5),
  title: z.string().trim().min(2, 'Give your review a title.').max(120),
  body: z.string().trim().min(10, 'Tell drivers a little more (10+ characters).').max(4000),
  visited_on: optional(z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the date picker.')),
  truck_type: optional(z.string().trim().max(40)),
  reviewer_name: optional(z.string().trim().max(80)),
  company_website: honeypot,
  turnstileToken: z.string().optional(),
});

export type ReviewInput = z.infer<typeof reviewSchema>;
