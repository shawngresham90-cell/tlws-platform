import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';
import { log } from '@/lib/api/logger';
import {
  buildSmsConsentRecord,
  consentEvidenceMatches,
  PG_UNIQUE_VIOLATION,
  type SmsConsentInput,
  type StoredConsentRow,
} from './sms-consent';

/** Columns re-checked when a submission token collides — no PII beyond the row. */
const MATCH_COLUMNS =
  'submission_id, sms_consent, sms_consent_version, source_form, source_url, disclosure_text, phone, email';

/**
 * Record one SMS-consent evidence row, SERVER-AUTHORITATIVELY, and report
 * whether durable consent evidence now exists. The caller passes only the form
 * key, the contact identity, the boolean the user chose, and an optional
 * per-submission idempotency token; everything that constitutes evidence — the
 * timestamp (server clock, only when true), the fixed version, the source URL,
 * and the exact disclosure text — is set here, never from the client.
 *
 * Returns `true` only when durable, matching opt-in evidence is guaranteed to
 * exist for THIS request:
 *   - the insert succeeded (a fresh affirmative row), OR
 *   - the insert hit the unique index on `submission_id` AND the existing row is
 *     verified to match this exact request in every security-relevant field
 *     (token, affirmative consent, version, source form + URL, disclosure,
 *     normalized phone + email).
 *
 * A collision whose stored row is missing or differs in ANY field returns
 * `false` — so a client can never reuse an existing submission token to gain
 * SMS eligibility for a different phone, email, form, or disclosure version.
 *
 * The caller uses this to FAIL CLOSED: the mutable `sms_consent` flag is set to
 * `true` ONLY when this returns `true`. This never throws and never blocks the
 * form submission. Logging is deliberately minimal — a safe event/code and the
 * source form only, never the phone, email, disclosure, or token.
 */
export async function recordSmsConsent(input: SmsConsentInput): Promise<boolean> {
  try {
    const supabase = createAdminClient();
    // The server clock is the sole authority on the timestamp; the pure builder
    // stamps it only for an affirmative opt-in and drops any non-UUID token.
    const record = buildSmsConsentRecord(input, new Date().toISOString());
    const { error } = await supabase.from('sms_consents').insert(record);
    if (!error) return true;

    // A unique-violation on the submission token means a row with this token
    // already exists. Do NOT trust that blindly — re-read it and confirm it
    // matches this exact request AND is an affirmative opt-in before treating it
    // as durable consent. Anything else fails closed.
    if (error.code === PG_UNIQUE_VIOLATION) {
      if (record.submission_id == null) {
        // A tokenless insert never collides on the token index; a unique
        // violation here is some other constraint — no durable consent.
        log.error('sms_consent_record_failed', { source: input.sourceForm, code: error.code });
        return false;
      }
      const { data: existing, error: lookupError } = await supabase
        .from('sms_consents')
        .select(MATCH_COLUMNS)
        .eq('submission_id', record.submission_id)
        .maybeSingle();

      if (lookupError) {
        log.error('sms_consent_lookup_failed', {
          source: input.sourceForm,
          code: lookupError.code,
        });
        return false;
      }
      if (consentEvidenceMatches(existing as StoredConsentRow | null, record)) {
        log.info('sms_consent_record_duplicate', { source: input.sourceForm });
        return true;
      }
      // The token exists but the stored evidence does not match this request —
      // treat as an attempted reuse and fail closed (no PII in the log).
      log.warn('sms_consent_submission_reuse_mismatch', { source: input.sourceForm });
      return false;
    }

    // Any other failure (commonly, pre-migration: relation "sms_consents" does
    // not exist) is non-fatal to the submission but means NO durable evidence —
    // the caller must treat the contact as not opted in.
    log.error('sms_consent_record_failed', { source: input.sourceForm, code: error.code });
    return false;
  } catch (e) {
    // Never log the payload — only the error name, no PII.
    log.error('sms_consent_record_threw', { source: input.sourceForm, name: (e as Error).name });
    return false;
  }
}
