/**
 * What a repeat lead submission is allowed to change.
 *
 * The bug this exists to prevent: `/api/lead` upserted a full row on every
 * submit, so a form that never asked for a field still wrote `null` into it.
 * A driver who gave their name and phone on the founder form and later typed
 * their email into the homepage newsletter box had both silently erased, their
 * first-touch campaign replaced with `{}`, and their acquisition source
 * relabelled `newsletter`. Confirmed against production on 2026-08-02.
 *
 * The rule now: a submission may only write what its own form actually
 * collected. Everything else is left alone — not re-written with the value we
 * just read, but genuinely absent from the UPDATE, so two submissions racing on
 * the same address cannot clobber each other's untouched columns.
 *
 * FIRST TOUCH IS IMMUTABLE. `source` and `utm` describe how someone first
 * arrived. That is a historical fact; a later visit does not change it. Both
 * are written once, at insert, and never updated. Ongoing participation is
 * recorded separately as append-only evidence (see email-consent.ts) rather
 * than by overwriting the origin.
 *
 * CONSENT ONLY EVER RISES. `sms_consent` is set only by a form that actually
 * displayed the SMS disclosure and got a durable evidence row. A form that
 * never asked cannot lower an existing opt-in to false — that would silently
 * revoke a consent the driver did give, and the evidence log would then
 * disagree with the flag.
 */

/** The subset of a lead row this module reasons about. */
export type LeadPatch = {
  first_name?: string;
  phone?: string;
  sms_consent?: true;
};

export type SubmissionFields = {
  /** Present only when the submitting form has a name input. */
  firstName?: string | null;
  /** Present only when the submitting form has a phone input. */
  phone?: string | null;
  /**
   * True only when this submission produced a durable SMS-consent evidence
   * row. Never `false` for "the form didn't ask" — pass undefined for that.
   */
  smsConsentGranted?: boolean;
};

function meaningful(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

/**
 * Build the UPDATE payload for an email that already has a lead row.
 *
 * Returns only keys this submission has the standing to change. An empty
 * object means "nothing to write" — the caller should skip the UPDATE entirely
 * so a repeat signup is a true no-op rather than a pointless row version.
 */
export function buildLeadPatch(fields: SubmissionFields): LeadPatch {
  const patch: LeadPatch = {};
  if (meaningful(fields.firstName)) patch.first_name = fields.firstName.trim();
  if (meaningful(fields.phone)) patch.phone = fields.phone.trim();
  // Only ever raise. `false` and `undefined` both mean "leave it as it is".
  if (fields.smsConsentGranted === true) patch.sms_consent = true;
  return patch;
}

/** True when a repeat submission has nothing it is permitted to change. */
export function isNoOpPatch(patch: LeadPatch): boolean {
  return Object.keys(patch).length === 0;
}

/**
 * Columns a repeat submission must never appear to write, at any value. Used
 * by the route and asserted by the test suite so the guarantee is enforced
 * rather than merely intended.
 */
export const IMMUTABLE_AFTER_INSERT = ['email', 'source', 'utm', 'created_at'] as const;

/** The row written when the address is genuinely new. First touch is captured here, once. */
export function buildLeadInsert(input: {
  email: string;
  firstName?: string | null;
  phone?: string | null;
  smsConsentGranted?: boolean;
  source?: string | null;
  utm: unknown;
}) {
  return {
    email: input.email,
    first_name: meaningful(input.firstName) ? input.firstName.trim() : null,
    phone: meaningful(input.phone) ? input.phone.trim() : null,
    sms_consent: input.smsConsentGranted === true,
    source: input.source ?? null,
    utm: input.utm,
  };
}
