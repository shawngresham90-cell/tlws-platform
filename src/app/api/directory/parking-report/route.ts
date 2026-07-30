import { guardedPost } from '@/lib/api/handler';
import { createAdminClient } from '@/lib/supabase/admin';
import { ok, fail } from '@/lib/api/responses';
import { log } from '@/lib/api/logger';
import {
  parkingReportSchema,
  encodeReportComments,
  submissionKindFor,
} from '@/lib/community/parking-report';

export const runtime = 'nodejs';

/**
 * Driver parking reports — the fast phone path (2026-07-30).
 *
 * HARD GUARANTEE: this route only ever INSERTs into
 * `public.location_submissions` with status 'pending'. It performs no update,
 * upsert or delete, and it never touches `public.locations` except for one
 * read that confirms the reported listing exists. A driver can therefore
 * never modify, publish, unpublish, enrich or overwrite production parking
 * data — an admin reviews every row by hand.
 *
 * Abuse controls: per-IP rate limit, a honeypot that fakes success, bounded
 * field lengths, http(s)-only evidence links, and no personal data collected
 * (no name, no contact, no account required, no location tracking).
 */
export const POST = guardedPost(
  parkingReportSchema,
  { routeKey: 'parking-report', rateLimitMax: 6, rateLimitWindowMs: 60_000 },
  async ({ data }) => {
    // Honeypot: only bots fill it. Report success so they learn nothing, and
    // store absolutely nothing.
    if (data.company_website) {
      log.info('parking_report_honeypot', { mode: data.mode });
      return ok({ received: true }, 201);
    }

    const supabase = createAdminClient();

    // An issue report must point at a real, published listing. This is a
    // READ; it exists so junk ids cannot fill the queue.
    if (data.mode === 'issue') {
      const { data: target } = await supabase
        .from('locations')
        .select('id')
        .eq('id', data.locationId)
        .eq('is_published', true)
        .is('deleted_at', null)
        .maybeSingle();
      if (!target) return fail('That listing could not be found.', 422, 'unknown_location');
    }

    const { data: row, error } = await supabase
      .from('location_submissions')
      .insert({
        kind: submissionKindFor(data),
        location_id: data.mode === 'issue' ? data.locationId : null,
        // A correction carries no name of its own; the listing supplies it.
        name: data.mode === 'missing' ? data.name : 'Driver report',
        state: data.mode === 'missing' ? data.state : null,
        city: data.mode === 'missing' ? (data.city ?? null) : null,
        address: data.mode === 'missing' ? (data.address ?? null) : null,
        comments: encodeReportComments(data),
        // Quarantine: a proposed location is a submission, never a listing.
        status: 'pending',
      })
      .select('id')
      .single();

    if (error || !row) {
      log.error('parking_report_insert_failed', { code: error?.code });
      return fail('Could not send your report. Try again.', 500, 'db_error');
    }

    log.info('parking_report_received', { id: row.id, mode: data.mode });
    return ok({ received: true }, 201);
  },
);
