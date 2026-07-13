import { z } from 'zod';

/**
 * Founding Student claim — the zod contract for the public intake route.
 * Everything that passes lands in `preschool_founding_claims` with status
 * 'pending'; nothing here can publish content or grant a wall spot.
 */

/** Empty strings from form fields count as absent. */
const optional = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v), schema.optional());

/** Public website links must be https — anything else never renders. */
const httpsUrl = z
  .string()
  .trim()
  .max(300)
  .refine(
    (v) => {
      try {
        return new URL(v).protocol === 'https:';
      } catch {
        return false;
      }
    },
    { message: 'Website must be a full https:// URL.' },
  );

/** Honeypot: humans never see it; any value means a bot filled the form. */
const honeypot = z.string().max(200).optional().default('');

export const claimSchema = z
  .object({
    purchaser_email: z
      .string()
      .trim()
      .toLowerCase()
      .email('Enter the email you used at Stan Store checkout.')
      .max(200),
    display_name: z
      .string()
      .trim()
      .min(2, 'Enter the name you want on the wall (2+ characters).')
      .max(80),
    is_anonymous: z.boolean().default(false),
    business_name: optional(z.string().trim().max(120)),
    website_url: optional(httpsUrl),
    confirmed_checkout: z.boolean(),
    consent_public_display: z.boolean(),
    company_website: honeypot,
    turnstileToken: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.confirmed_checkout) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['confirmed_checkout'],
        message: 'Confirm that you completed checkout on Stan Store.',
      });
    }
    if (!data.consent_public_display) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['consent_public_display'],
        message: 'Consent to the public display of your chosen information.',
      });
    }
  });

export type ClaimInput = z.infer<typeof claimSchema>;
