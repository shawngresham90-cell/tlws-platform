import { guardedPost } from '@/lib/api/handler';
import { sponsorInquirySchema } from '@/lib/api/schemas';
import { createAdminClient } from '@/lib/supabase/admin';
import { ok, fail } from '@/lib/api/responses';
import { log } from '@/lib/api/logger';

export const runtime = 'nodejs';

/**
 * Sponsor inquiry. Inserts a prospect into the sponsor pipeline (stage
 * 'contacted', inbound) and logs an inbound touch. Feeds the sprint CRM.
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
        stage: 'contacted',
        priority: 3,
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
      summary: 'Website sponsor inquiry',
    });

    log.info('sponsor_inquiry_created', { sponsor_id: sponsor.id });
    return ok({ sponsor_id: sponsor.id }, 201);
  },
);
