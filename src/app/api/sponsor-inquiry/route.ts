import { guardedPost } from '@/lib/api/handler';
import { sponsorInquirySchema } from '@/lib/api/schemas';
import { createAdminClient } from '@/lib/supabase/admin';
import { ok, fail } from '@/lib/api/responses';
import { log } from '@/lib/api/logger';

export const runtime = 'nodejs';

/**
 * Sponsor inquiry. Files a prospect into the sponsor pipeline and logs the
 * inbound touch that started it.
 *
 * The row lands at stage `prospect`, not `contacted`. An arriving inquiry means
 * a business reached out — it does not mean anyone has replied, and recording
 * it as "contacted" made the pipeline unable to tell "nobody has answered this
 * yet" from "I called them", which is the single most useful distinction the
 * owner has when the queue is more than one row long. Moving to `contacted` is
 * a deliberate act on the revenue console, and it is what "contact rate"
 * counts.
 *
 * `tier_interest` is validated against the approved offer set by the schema, so
 * the offer recorded here is always one the platform actually sells.
 */
export const POST = guardedPost(
  sponsorInquirySchema,
  { routeKey: 'sponsor_inquiry', rateLimitMax: 5 },
  async ({ data }) => {
    const supabase = createAdminClient();

    const { data: sponsor, error } = await supabase
      .from('sponsors')
      .insert({
        company: data.company,
        contact_name: data.contact_name ?? null,
        email: data.email,
        phone: data.phone || null,
        tier_interest: data.tier_interest ?? null,
        stage: 'prospect',
        priority: 3,
        // A new inquiry arrives with its first action already set, so it shows
        // up in the owner's queue as work rather than as a row to notice.
        next_action: 'Reply to this inquiry',
        next_action_date: new Date().toISOString().slice(0, 10),
        notes: data.message ?? null,
      })
      .select('id')
      .single();

    if (error || !sponsor) {
      log.error('sponsor_inquiry_insert_failed', { code: error?.code });
      return fail('Could not submit your inquiry. Try again.', 500, 'db_error');
    }

    await supabase.from('sponsor_touches').insert({
      sponsor_id: sponsor.id,
      touch_type: 'other',
      direction: 'inbound',
      summary: `Website sponsor inquiry${data.tier_interest ? ` — ${data.tier_interest}` : ''}`,
    });

    log.info('sponsor_inquiry_created', { sponsor_id: sponsor.id });
    return ok({ sponsor_id: sponsor.id }, 201);
  },
);
