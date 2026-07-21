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
const city = z.string().trim().min(1, 'Enter your city.').max(80);
const usState = z
  .string()
  .trim()
  .regex(/^[A-Z]{2}$/, 'Select your state.');
const startTimeframe = z.enum(['asap', '30_days', '60_days', '90_plus', 'researching']);
// Bounded so a direct API caller can't store an arbitrarily large blob in the
// jsonb column; real utm_* params are far inside these limits.
const utm = z
  .record(z.string().max(40), z.string().max(200))
  .refine((m) => Object.keys(m).length <= 20, 'Too many parameters.')
  .optional()
  .default({});
const turnstileToken = z.string().min(1, 'Verification failed. Reload and try again.');

// --- Application step 1: the low-friction hook (name + contact + location) ---
export const applicationStep1Schema = z.object({
  first_name: name,
  last_name: name,
  email,
  phone,
  city,
  state: usState,
  start_timeframe: startTimeframe.optional(),
  utm,
  turnstileToken,
});

// --- Application step 2: the qualifying detail (updates the existing row) ---
export const applicationStep2Schema = z.object({
  application_id: z.string().uuid('Missing application reference.'),
  has_permit: z.boolean().optional(),
  age_confirmed: z.boolean().optional(),
  cdl_class: z.enum(['A', 'B', 'none']).optional(),
  start_timeframe: startTimeframe.optional(),
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
  // Optional WITHOUT a default: undefined means "this form didn't collect
  // consent", which the merge logic must distinguish from an explicit false.
  sms_consent: z.boolean().optional(),
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

// --- Practice-test attempt: anonymous completion log OR verified email save ---
// Two payload shapes through one route (so the attempt is never double-logged):
//   * answers only  → anonymous attempt log (graded server-side)
//   * email only    → Turnstile-verified lead save, NO second attempt row
//   * both          → one attempt row carrying lead_email
export const testAttemptSchema = z
  .object({
    test_slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Invalid test.')
      .max(60),
    // Selected choice key per question id. Bounded hard so junk can't balloon
    // the jsonb column; the handler additionally drops unknown question ids.
    answers: z
      .record(z.string().uuid('Invalid question id.'), z.string().trim().min(1).max(8))
      .optional(),
    email: email.optional(),
    // Attempt analytics: which runner produced it and how long it took.
    // The handler clamps elapsed_seconds against the test's time limit.
    mode: z.enum(['study', 'timed']).optional(),
    elapsed_seconds: z.number().int().min(0).max(86_400).optional(),
    // Optional for the anonymous completion log; REQUIRED (and verified by the
    // guard stack) whenever an email is being saved.
    turnstileToken: z.string().min(1).optional(),
  })
  .refine((d) => (d.answers && Object.keys(d.answers).length >= 1) || Boolean(d.email), {
    message: 'No answers submitted.',
  })
  .refine((d) => !d.answers || Object.keys(d.answers).length <= 200, {
    message: 'Too many answers.',
  })
  .refine((d) => !d.email || Boolean(d.turnstileToken), {
    message: 'Verification failed. Reload and try again.',
  });

export type ApplicationStep1 = z.infer<typeof applicationStep1Schema>;
export type ApplicationStep2 = z.infer<typeof applicationStep2Schema>;
export type LeadCapture = z.infer<typeof leadCaptureSchema>;
export type SponsorInquiry = z.infer<typeof sponsorInquirySchema>;
export type TestAttempt = z.infer<typeof testAttemptSchema>;
