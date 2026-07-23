/**
 * SMS consent — the single source of truth for the disclosure text, its fixed
 * version, and the per-form source URLs. Client-safe (no server imports) so the
 * exact wording rendered next to the checkbox is byte-identical to what the
 * server stores as evidence. The server owns the timestamp, version, source,
 * and disclosure text — client-supplied consent metadata is never trusted
 * (see `sms-consent-server.ts`).
 *
 * Update `SMS_CONSENT_VERSION` and `SMS_CONSENT_DISCLOSURE` together whenever
 * the disclosure wording changes; old records keep their captured version.
 */

/** Fixed disclosure version stamped on every consent record. */
export const SMS_CONSENT_VERSION = '2026-07-23';

/**
 * The EXACT provider-approved (Text Request) disclosure. This string is the
 * legally operative wording: it is shown next to the (unchecked-by-default)
 * consent checkbox and stored verbatim as evidence. The only on-screen
 * enhancement is that the words "Privacy Policy" are rendered as a link to
 * /privacy — nothing is added to or removed from this wording. The separate
 * SMS Terms link shown near the checkbox is NOT part of this disclosure and is
 * deliberately excluded from this string.
 *
 * Do not edit except to match a new provider-approved disclosure, and bump
 * `SMS_CONSENT_VERSION` in the same change; existing records keep their version.
 */
export const SMS_CONSENT_DISCLOSURE =
  'By checking yes, you agree to receive SMS text messages (updates about your school ' +
  'application and enrollment, and occasional related information) from Trucking Life Academy ' +
  'at the number provided. Consent is not a condition of any purchase or service. Msg & data ' +
  'rates may apply. Msg frequency varies. Reply STOP to opt out. Reply HELP for help. By ' +
  'submitting this form, you also agree to our Privacy Policy.';

/** Forms that display the SMS consent checkbox, mapped to the page they live on. */
export const SMS_CONSENT_SOURCES = {
  'academy-application': '/academy/apply',
  'founder-lead': '/founders',
} as const;

export type SmsConsentSource = keyof typeof SMS_CONSENT_SOURCES;

/** Type guard so the server only accepts a known form key. */
export function isSmsConsentSource(v: unknown): v is SmsConsentSource {
  return typeof v === 'string' && Object.hasOwn(SMS_CONSENT_SOURCES, v);
}

/** What the caller supplies — only the form, the contact, and the decision. */
export interface SmsConsentInput {
  sourceForm: SmsConsentSource;
  email?: string | null;
  phone?: string | null;
  consent: boolean;
  /**
   * Optional per-submission idempotency token (client-generated, reused across
   * retries of the SAME submit attempt). When present it is unique in the
   * evidence table, so a retried request de-duplicates to a single append-only
   * row instead of piling up conflicting evidence. A genuinely new submission
   * carries a new token and is recorded as a distinct historical event.
   */
  submissionId?: string | null;
}

/** The exact evidence row written to `sms_consents`. */
export interface SmsConsentRecord {
  source_form: SmsConsentSource;
  source_url: string;
  email: string | null;
  phone: string | null;
  sms_consent: boolean;
  sms_consent_at: string | null;
  sms_consent_version: string;
  disclosure_text: string;
  submission_id: string | null;
}

/** Canonical UUID (any version) — the only accepted submission-token shape. */
const SUBMISSION_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Strict format+length validation for the per-submission idempotency token.
 * Only a canonical UUID (as produced by `crypto.randomUUID()`) is accepted; a
 * malformed, over-long, or non-string value is rejected so it is never stored
 * or trusted as an idempotency key.
 */
export function isValidSubmissionId(v: unknown): v is string {
  return typeof v === 'string' && v.length <= 36 && SUBMISSION_ID_RE.test(v.trim());
}

/** Normalize an email for comparison: trimmed + lowercased, empty → null. */
export function normalizeEmail(v?: string | null): string | null {
  const s = v?.trim().toLowerCase();
  return s ? s : null;
}

/** Normalize a phone for comparison: trimmed, empty → null. */
export function normalizePhone(v?: string | null): string | null {
  const s = v?.trim();
  return s ? s : null;
}

/**
 * Build the server-authoritative evidence row. Pure and side-effect-free: the
 * server clock (`nowIso`) is injected by the caller so this stays deterministic
 * and unit-testable. Everything that constitutes evidence — the source URL, the
 * fixed version, and the exact disclosure — is set here from the trusted
 * constants, never from the client.
 *
 * The timestamp is stamped ONLY for an affirmative opt-in. A decline is still
 * recorded (sms_consent = false) but with a null timestamp, matching the DB
 * check constraint and keeping "unchecked" durably opted out. Any non-`true`
 * value is treated as a decline. A submission token is kept ONLY when it is a
 * valid UUID; anything else is dropped to null (recorded tokenless, never used
 * as an idempotency key).
 */
export function buildSmsConsentRecord(input: SmsConsentInput, nowIso: string): SmsConsentRecord {
  const consent = input.consent === true;
  const rawId = input.submissionId?.trim();
  return {
    source_form: input.sourceForm,
    source_url: SMS_CONSENT_SOURCES[input.sourceForm],
    email: normalizeEmail(input.email),
    phone: normalizePhone(input.phone),
    sms_consent: consent,
    sms_consent_at: consent ? nowIso : null,
    sms_consent_version: SMS_CONSENT_VERSION,
    disclosure_text: SMS_CONSENT_DISCLOSURE,
    submission_id: rawId && isValidSubmissionId(rawId) ? rawId : null,
  };
}

/** Postgres unique-violation SQLSTATE — a retried submission token collision. */
export const PG_UNIQUE_VIOLATION = '23505';

/**
 * The subset of a stored `sms_consents` row we re-check on a submission-token
 * collision. Mirrors the security-relevant columns of `SmsConsentRecord`.
 */
export interface StoredConsentRow {
  submission_id: string | null;
  sms_consent: boolean;
  sms_consent_version: string;
  source_form: string;
  source_url: string;
  disclosure_text: string;
  phone: string | null;
  email: string | null;
}

/**
 * Whether an existing evidence row (found via a `submission_id` collision) is a
 * legitimate match for the CURRENT request AND is itself an affirmative opt-in.
 *
 * A reused submission token may grant SMS eligibility ONLY when every
 * security-relevant field is identical: the token, an affirmative
 * `sms_consent`, the version, the source form + URL, the exact disclosure, and
 * the normalized phone and email. Any missing row or differing field returns
 * `false` (fail closed), so a client can never reuse someone else's token — or
 * its own token with a different phone/email/form/version — to become textable.
 */
export function consentEvidenceMatches(
  existing: StoredConsentRow | null | undefined,
  expected: SmsConsentRecord,
): boolean {
  if (!existing) return false;
  // Only an affirmative, tokened request can ever match.
  if (expected.sms_consent !== true) return false;
  if (expected.submission_id == null) return false;
  return (
    existing.sms_consent === true &&
    existing.submission_id === expected.submission_id &&
    existing.sms_consent_version === expected.sms_consent_version &&
    existing.source_form === expected.source_form &&
    existing.source_url === expected.source_url &&
    existing.disclosure_text === expected.disclosure_text &&
    normalizePhone(existing.phone) === normalizePhone(expected.phone) &&
    normalizeEmail(existing.email) === normalizeEmail(expected.email)
  );
}

/**
 * FAIL-CLOSED consent resolution — the single source of truth for whether the
 * mutable `sms_consent` flag on an application/lead may be set to `true`. It may
 * be true ONLY when the person affirmatively opted in AND durable evidence was
 * recorded. Any other combination (declined, or opted-in but evidence failed)
 * resolves to `false`, so a contact is never marked textable without a matching
 * consent-evidence record.
 */
export function resolveConsentGrant(consentRequested: boolean, evidenceDurable: boolean): boolean {
  return consentRequested === true && evidenceDurable === true;
}
