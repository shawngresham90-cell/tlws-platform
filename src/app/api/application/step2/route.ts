import { guardedPost } from '@/lib/api/handler';
import { applicationStep2Schema } from '@/lib/api/schemas';
import { createAdminClient } from '@/lib/supabase/admin';
import { ok, fail } from '@/lib/api/responses';
import { log } from '@/lib/api/logger';
import { SMS_CONSENT_DISCLOSURE, resolveConsentGrant } from '@/lib/leads/sms-consent';
import { recordSmsConsent } from '@/lib/leads/sms-consent-server';

export const runtime = 'nodejs';

/**
 * Application funnel — step 2 (qualify). Updates the existing row with permit,
 * class, funding, and SMS consent. No Turnstile here — the row already exists
 * and is referenced by uuid.
 *
 * FAIL-CLOSED consent: the mutable `sms_consent` flag on the application is set
 * to `true` ONLY after a durable evidence row is recorded. If the applicant
 * checked the box but evidence recording fails, the application is still saved,
 * but `sms_consent` stays `false` and the contact is NOT textable — the row is
 * never left `true` without matching evidence.
 */
export const POST = guardedPost(
  applicationStep2Schema,
  { routeKey: 'application_step2', rateLimitMax: 10, requireTurnstile: false },
  async ({ data }) => {
    const supabase = createAdminClient();

    // Read the contact captured at step 1 so the evidence row references the
    // stored values, not a client-asserted phone/email.
    const { data: existing, error: readError } = await supabase
      .from('applications')
      .select('id, email, phone')
      .eq('id', data.application_id)
      .single();

    if (readError || !existing) {
      log.error('application_step2_read_failed', { code: readError?.code });
      return fail('Could not update your application.', 500, 'db_error');
    }

    // Record consent evidence FIRST, then honor the mutable flag only if durable
    // evidence exists. `recordSmsConsent` never throws and is retry-safe via the
    // submission token. We record the decision either way (opt-in or decline);
    // `granted` gates the textable flag.
    const consentRequested = data.sms_consent === true;
    const durable = await recordSmsConsent({
      sourceForm: 'academy-application',
      email: (existing as { email?: string | null }).email,
      phone: (existing as { phone?: string | null }).phone,
      consent: consentRequested,
      submissionId: data.submission_id,
    });
    const granted = resolveConsentGrant(consentRequested, durable);

    const update: Record<string, unknown> = {
      has_permit: data.has_permit ?? null,
      age_confirmed: data.age_confirmed ?? null,
      cdl_class: data.cdl_class ?? null,
      funding_type: data.funding_type ?? null,
      step2_completed: true,
      // Fail closed: true only with durable evidence; otherwise false + null.
      sms_consent: granted,
      sms_consent_at: granted ? new Date().toISOString() : null,
      sms_consent_text: granted ? SMS_CONSENT_DISCLOSURE : null,
    };

    // Only set the timeframe if this step supplied one — don't clobber step 1.
    if (data.start_timeframe) update.start_timeframe = data.start_timeframe;

    const { data: row, error } = await supabase
      .from('applications')
      .update(update)
      .eq('id', data.application_id)
      .select('id')
      .single();

    if (error || !row) {
      log.error('application_step2_update_failed', { code: error?.code });
      return fail('Could not update your application.', 500, 'db_error');
    }

    await supabase.from('application_events').insert({
      application_id: row.id,
      event_type: 'step2',
      // Reflects the effective (fail-closed) decision, not just the request.
      detail: { sms_consent: granted },
    });

    log.info('application_step2_completed', { application_id: row.id });
    return ok({ application_id: row.id });
  },
);
