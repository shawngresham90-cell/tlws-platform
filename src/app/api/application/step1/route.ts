import { guardedPost } from '@/lib/api/handler';
import { applicationStep1Schema } from '@/lib/api/schemas';
import { createAdminClient } from '@/lib/supabase/admin';
import { ok, fail } from '@/lib/api/responses';
import { log } from '@/lib/api/logger';

export const runtime = 'nodejs';

/**
 * Application funnel — step 1 (the hook). Creates the application row with
 * status 'new'. Returns application_id so step 2 can update the same record.
 */
export const POST = guardedPost(
  applicationStep1Schema,
  { routeKey: 'application_step1', rateLimitMax: 5, rateLimitWindowMs: 60_000 },
  async ({ data }) => {
    const supabase = createAdminClient();

    const { data: row, error } = await supabase
      .from('applications')
      .insert({
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email,
        phone: data.phone || null,
        start_timeframe: data.start_timeframe ?? null,
        utm: data.utm,
        status: 'new',
      })
      .select('id')
      .single();

    if (error || !row) {
      log.error('application_step1_insert_failed', { code: error?.code });
      return fail('Could not save your application. Try again.', 500, 'db_error');
    }

    await supabase.from('application_events').insert({
      application_id: row.id,
      event_type: 'submitted',
      detail: { step: 1 },
    });

    log.info('application_step1_created', { application_id: row.id });
    // Email/SMS intentionally NOT sent here (Milestone 4: dormant).
    return ok({ application_id: row.id }, 201);
  },
);
