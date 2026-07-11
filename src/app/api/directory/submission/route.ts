import { guardedPost } from '@/lib/api/handler';
import { submissionSchema } from '@/lib/community/schemas';
import { createAdminClient } from '@/lib/supabase/admin';
import { ok, fail } from '@/lib/api/responses';
import { log } from '@/lib/api/logger';

export const runtime = 'nodejs';

/**
 * Driver location submissions (new listings, corrections, closures, missing
 * info, amenity changes). Every accepted payload is INSERTED with status
 * 'pending' — nothing on this route can touch public.locations or publish
 * anything; approval happens only in the admin dashboard.
 */
export const POST = guardedPost(
  submissionSchema,
  { routeKey: 'directory-submission', rateLimitMax: 5 },
  async ({ data }) => {
    // Honeypot tripped: a hidden field only bots fill. Pretend success so the
    // bot learns nothing; store nothing.
    if (data.company_website) {
      log.info('submission_honeypot', { kind: data.kind });
      return ok({ received: true }, 201);
    }

    const supabase = createAdminClient();

    // Reports about an existing listing must point at a real, live listing.
    if (data.location_id) {
      const { data: target } = await supabase
        .from('locations')
        .select('id')
        .eq('id', data.location_id)
        .eq('is_published', true)
        .is('deleted_at', null)
        .maybeSingle();
      if (!target) return fail('That listing could not be found.', 422, 'unknown_location');
    }

    const { data: row, error } = await supabase
      .from('location_submissions')
      .insert({
        kind: data.kind,
        location_id: data.location_id ?? null,
        name: data.name,
        category_slug: data.category_slug ?? null,
        address: data.address ?? null,
        city: data.city ?? null,
        state: data.state ?? null,
        zip: data.zip ?? null,
        phone: data.phone ?? null,
        website: data.website ?? null,
        description: data.description ?? null,
        amenities: data.amenities,
        free_parking: data.free_parking,
        paid_parking: data.paid_parking,
        reserved_parking: data.reserved_parking,
        overnight_parking: data.overnight_parking,
        parking_spaces: data.parking_spaces ?? null,
        comments: data.comments ?? null,
        submitter_name: data.submitter_name ?? null,
        submitter_contact: data.submitter_contact ?? null,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error || !row) {
      log.error('submission_insert_failed', { code: error?.code });
      return fail('Could not save your submission. Try again.', 500, 'db_error');
    }

    log.info('submission_received', { id: row.id, kind: data.kind });
    return ok({ received: true }, 201);
  },
);
