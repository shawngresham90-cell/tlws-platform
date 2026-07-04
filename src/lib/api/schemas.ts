import { z } from 'zod';

/** Shared field builders — one source of truth for validation rules. */
const email = z.string().trim().toLowerCase().email('Enter a valid email.').max(254);
const phone = z
  .string()
  .trim()
  .regex(/^[0-9+()\-.\s]{7,20}$/, 'Enter a valid phone number.')
  .optional()
  .or(z.literal(''));
const name = z.string().trim().min(1).max(80);
const utm = z.record(z.string(), z.string()).optional().default({});
const turnstileToken = z.string().min(1, 'Verification failed. Reload and try again.');

// --- Application step 1: the low-friction hook (name + email + contact intent) ---
export const applicationStep1Schema = z.object({
  first_name: name,
  last_name: name,
  email,
  phone,
  start_timeframe: z
    .enum(['asap', '30_days', '60_days', '90_plus', 'researching'])
    .optional(),
  utm,
  turnstileToken,
});

// --- Application step 2: the qualifying detail (updates the existing row) ---
export const applicationStep2Schema = z.object({
  application_id: z.string().uuid('Missing application reference.'),
  has_permit: z.boolean().optional(),
  cdl_class: z.enum(['A', 'B', 'none']).optional(),
  funding_type: z.enum(['self', 'employer', 'wioa', 'va', 'sponsor', 'unsure']).optional(),
  sms_consent: z.boolean().default(false),
  sms_consent_text: z.string().max(500).optional(),
});

// --- Lead capture: email-first, optional magnet claim ---
export const leadCaptureSchema = z.object({
  email,
  first_name: name.optional(),
  phone,
  source: z.string().trim().max(40).optional(),
  magnet_slug: z.string().trim().max(80).optional(),
  sms_consent: z.boolean().default(false),
  utm,
  turnstileToken,
});

// --- Sponsor inquiry: business-side lead ---
export const sponsorInquirySchema = z.object({
  company: z.string().trim().min(1).max(120),
  contact_name: name.optional(),
  email,
  phone,
  tier_interest: z.string().trim().max(60).optional(),
  message: z.string().trim().max(2000).optional(),
  turnstileToken,
});

export type ApplicationStep1 = z.infer<typeof applicationStep1Schema>;
export type ApplicationStep2 = z.infer<typeof applicationStep2Schema>;
export type LeadCapture = z.infer<typeof leadCaptureSchema>;
export type SponsorInquiry = z.infer<typeof sponsorInquirySchema>;
