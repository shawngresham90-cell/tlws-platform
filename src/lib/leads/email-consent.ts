/**
 * Email-consent evidence — the model, and the blocker holding it back.
 *
 * The homepage newsletter form tells drivers something to the effect of "no
 * spam, unsubscribe anytime" and stores nothing to show they agreed. That is
 * copy, not a record. `sms_consents` already solves this problem properly for
 * text messages: append-only, server-authoritative, storing the exact wording
 * shown at the moment of collection. This mirrors that shape for email.
 *
 * DELIBERATELY NOT `sms_consents`. Reusing it would put two different legal
 * regimes in one log, force `sms_consent` to mean "some consent", and make an
 * SMS-scoped retention or deletion request ambiguous about which rows it
 * covers. Separate concerns, separate evidence.
 *
 * NOTHING HERE IS ACTIVE. `EMAIL_CONSENT_RECORDING_ENABLED` is false, and the
 * tables it needs (migration 049) have not been applied. The flag exists so the
 * route can be wired and tested now and switched on in one reviewed line once
 * the migration is applied and the wording below is approved — rather than a
 * later change having to rediscover all of this.
 *
 * WHERE "IS THIS PERSON SUBSCRIBED?" IS ANSWERED: not here. Migration 049
 * defines `email_subscription_status`, a view that derives the answer from the
 * consent and unsubscribe logs — latest instruction wins, ties fail closed.
 * That rule is deliberately NOT reimplemented in TypeScript. Two copies of a
 * consent rule can disagree, and the moment they do there is no way to tell
 * which one a given send actually used. This module builds evidence rows; the
 * database decides what they add up to.
 */

/**
 * OWNER APPROVAL REQUIRED — EMAIL-CONSENT-01.
 *
 * The exact sentence shown next to the newsletter email field, stored verbatim
 * with every consent row as the evidence of what the driver actually agreed to.
 *
 * This is deliberately empty. Consent wording is a legal statement about what
 * Trucking Life will and will not do with an address, and nothing here may
 * invent it. Shawn supplies the exact text; it is pasted in unchanged, and the
 * version below is incremented in the same commit.
 *
 * What the approved text has to settle, as questions rather than as suggested
 * wording:
 *   1. What is being sent (what kind of email, roughly how often)?
 *   2. Who is sending it?
 *   3. How does someone stop receiving it?
 *   4. Is the address shared with anyone outside Trucking Life?
 *
 * Until it is filled in, `EMAIL_CONSENT_DISCLOSURE_PENDING_OWNER_APPROVAL` stays empty,
 * `hasApprovedDisclosure()` returns false, and recording stays off — the
 * newsletter keeps working exactly as it does today, minus the data loss.
 */
export const EMAIL_CONSENT_DISCLOSURE_PENDING_OWNER_APPROVAL = '';

/**
 * Version of the disclosure text above. MUST be incremented in the same commit
 * as any edit to the wording — an evidence row proves what someone agreed to
 * only if the version and the text move together. `v0-unapproved` marks the
 * pre-approval state; the first approved wording becomes `v1`.
 */
export const EMAIL_CONSENT_VERSION = 'v0-unapproved';

/** Forms permitted to collect email consent. Server-side allowlist, never client-supplied. */
export const EMAIL_CONSENT_SOURCE_FORMS = ['newsletter', 'founder', 'practice-test'] as const;
export type EmailConsentSourceForm = (typeof EMAIL_CONSENT_SOURCE_FORMS)[number];

/**
 * Master switch. Stays false until BOTH are true:
 *   1. migration 049 has been applied (the table exists), and
 *   2. EMAIL_CONSENT_DISCLOSURE_PENDING_OWNER_APPROVAL holds owner-approved wording.
 *
 * Recording against a missing table would fail every submission; recording
 * empty wording would produce evidence that proves nothing. Either way the
 * honest state is off.
 */
export const EMAIL_CONSENT_RECORDING_ENABLED = false;

/** True only when real wording has been approved. Empty or whitespace is not approval. */
export function hasApprovedDisclosure(
  text: string = EMAIL_CONSENT_DISCLOSURE_PENDING_OWNER_APPROVAL,
): boolean {
  return text.trim().length > 0;
}

/**
 * Whether a consent row may be written right now. Both gates, not either —
 * so switching the flag on without approved wording still records nothing.
 */
export function canRecordEmailConsent(
  enabled: boolean = EMAIL_CONSENT_RECORDING_ENABLED,
  text: string = EMAIL_CONSENT_DISCLOSURE_PENDING_OWNER_APPROVAL,
): boolean {
  return enabled && hasApprovedDisclosure(text);
}

/** The evidence row, exactly as migration 049 defines it. */
export type EmailConsentRecord = {
  source_form: EmailConsentSourceForm;
  source_url: string;
  email: string;
  email_consent: boolean;
  /** Server time, and only for an affirmative opt-in. */
  email_consent_at: string | null;
  email_consent_version: string;
  disclosure_text: string;
  /** Per-submission idempotency token, so a retried submit de-duplicates. */
  submission_id: string | null;
};

/**
 * Build an evidence row. Server-authoritative: the caller supplies only the
 * decision, the address, the form and the URL. Wording, version and timestamp
 * come from here and from the server clock — never from the client, which
 * could otherwise claim consent to text it was never shown.
 *
 * `email_consent_at` is set only when consent is true, mirroring the
 * `sms_consents_at_only_when_true` constraint: a timestamp on a decline would
 * imply an opt-in moment that never happened.
 */
export function buildEmailConsentRecord(input: {
  sourceForm: EmailConsentSourceForm;
  sourceUrl: string;
  email: string;
  consent: boolean;
  submissionId?: string | null;
  now: Date;
}): EmailConsentRecord {
  return {
    source_form: input.sourceForm,
    source_url: input.sourceUrl,
    email: input.email.trim().toLowerCase(),
    email_consent: input.consent,
    email_consent_at: input.consent ? input.now.toISOString() : null,
    email_consent_version: EMAIL_CONSENT_VERSION,
    disclosure_text: EMAIL_CONSENT_DISCLOSURE_PENDING_OWNER_APPROVAL,
    submission_id: input.submissionId ?? null,
  };
}

/* ── Consent out ────────────────────────────────────────────────────────── */

/**
 * How an opt-out reached us. MUST stay in step with the
 * `email_unsubscribes_method_known` check constraint in migration 049 — the
 * newsletter-correctness harness asserts the two lists match, so a value added
 * here without a migration fails the build rather than every insert at runtime.
 *
 *   link      the unsubscribe link in an email footer
 *   one-click RFC 8058 List-Unsubscribe-Post, actioned by the mail client
 *   reply     they replied asking to stop; recorded by hand
 *   complaint a spam report relayed by the sending provider
 *   manual    any other owner-recorded request, explained in `note`
 */
export const UNSUBSCRIBE_METHODS = ['link', 'one-click', 'reply', 'complaint', 'manual'] as const;
export type UnsubscribeMethod = (typeof UNSUBSCRIBE_METHODS)[number];

/** An append-only opt-out row, exactly as migration 049 defines it. */
export type EmailUnsubscribeRecord = {
  email: string;
  method: UnsubscribeMethod;
  note: string | null;
  submission_id: string | null;
};

/**
 * Build an opt-out row.
 *
 * NO DISCLOSURE, NO VERSION, NO CONSENT GATE. Unlike
 * `buildEmailConsentRecord`, this asks nothing of
 * `EMAIL_CONSENT_RECORDING_ENABLED` or of approved wording. An opt-out is the
 * one instruction that must always be recordable: gating it on the same
 * switches that hold back consent collection would mean a period where someone
 * could ask to stop and we had nowhere to put it. Recording an opt-out for an
 * address that never consented is harmless — it can only ever reduce what we
 * send.
 *
 * The address is normalized here to match the check constraint on the column.
 * A differently-cased spelling would land as a separate identity and leave the
 * real one still subscribed.
 */
export function buildEmailUnsubscribeRecord(input: {
  email: string;
  method: UnsubscribeMethod;
  note?: string | null;
  submissionId?: string | null;
}): EmailUnsubscribeRecord {
  const note = input.note?.trim();
  return {
    email: input.email.trim().toLowerCase(),
    method: input.method,
    note: note ? note : null,
    submission_id: input.submissionId ?? null,
  };
}

/**
 * IP address and user agent are NOT part of this model.
 *
 * `sms_consents` — the approved evidence model this mirrors — stores neither,
 * and the brief permits them only if already conventional here. They are not.
 * Adding network identifiers to a consent log is a privacy expansion that would
 * need its own review and a privacy-policy update, and the timestamped
 * append-only row plus the verbatim wording is already the evidence that
 * matters. Recorded as a deliberate exclusion so it is not read as an omission.
 */
export const EVIDENCE_EXCLUDES_NETWORK_IDENTIFIERS = true;
