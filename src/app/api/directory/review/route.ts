import { guardedPost } from '@/lib/api/handler';
import { reviewSchema } from '@/lib/community/schemas';
import { createAdminClient } from '@/lib/supabase/admin';
import { ok, fail } from '@/lib/api/responses';
import { log } from '@/lib/api/logger';

export const runtime = 'nodejs';

/**
 * Driver reviews. Every accepted review is INSERTED with status 'pending' and
 * only appears publicly after an admin approves it in the dashboard — this
 * route cannot publish anything.
 */
export const POST = guardedPost(
  reviewSchema,
  { routeKey: 'directory-review', rateLimitMax: 5 },
  async ({ data }) => {
    // Honeypot tripped — pretend success, store nothing.
    if (data.company_website) {
      log.info('review_honeypot', {});
      return ok({ received: true }, 201);
    }

    const supabase = createAdminClient();

    const { data: target } = await supabase
      .from('locations')
      .select('id')
      .eq('id', data.location_id)
      .eq('is_published', true)
      .is('deleted_at', null)
      .maybeSingle();
    if (!target) return fail('That listing could not be found.', 422, 'unknown_location');

    const { data: row, error } = await supabase
      .from('location_reviews')
      .insert({
        location_id: data.location_id,
        rating: data.rating,
        title: data.title,
        body: data.body,
        visited_on: data.visited_on ?? null,
        truck_type: data.truck_type ?? null,
        reviewer_name: data.reviewer_name ?? null,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error || !row) {
      log.error('review_insert_failed', { code: error?.code });
      return fail('Could not save your review. Try again.', 500, 'db_error');
    }

    log.info('review_received', { id: row.id, rating: data.rating });
    return ok({ received: true }, 201);
  },
);
