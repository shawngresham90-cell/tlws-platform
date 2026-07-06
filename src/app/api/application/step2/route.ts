import { guardedPost } from '@/lib/api/handler';
import { applicationStep2Schema } from '@/lib/api/schemas';
import { createAdminClient } from '@/lib/supabase/admin';
import { ok, fail } from '@/lib/api/responses';
import { log } from '@/lib/api/logger';

export const runtime = 'nodejs';

/**
 * Application funnel — step 2 (qualify). Updates the existing row with permit,
 * class, funding, and SMS consent. Records consent timestamp for TCPA audit.
 * No Turnstile here — the row already exists and is referenced by uuid.
 */
export const POST = guardedPost(
  applicationStep2Schema,
  { routeKey: 'application_step2', rateLimitMax: 10, requireTurnstile: false },
  async ({ data }) => {
    const supabase = createAdminClient();

    const update: Record<string, unknown> = {
      has_permit: data.has_permit ?? null,
      age_confirmed: data.age_confirmed ?? null,
      cdl_class: data.cdl_class ?? null,
      funding_type: data.funding_type ?? null,
      step2_completed: true,
    };

    // Only set the timeframe if this step supplied one — don't clobber step 1.
    if (data.start_timeframe) update.start_timeframe = data.start_timeframe;

    if (data.sms_consent) {
      update.sms_consent = true;
      update.sms_consent_at = new Date().toISOString();
      update.sms_consent_text = data.sms_consent_text ?? null;
    }

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
      detail: { sms_consent: data.sms_consent },
    });

    log.info('application_step2_completed', { application_id: row.id });
    return ok({ application_id: row.id });
  },
);
