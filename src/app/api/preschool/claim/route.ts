import { guardedPost } from '@/lib/api/handler';
import { claimSchema } from '@/lib/preschool/schema';
import { createAdminClient } from '@/lib/supabase/admin';
import { ok, fail } from '@/lib/api/responses';
import { log } from '@/lib/api/logger';

export const runtime = 'nodejs';

/**
 * Founding Student claim intake. Every accepted payload is INSERTED with
 * status 'pending' — this route cannot publish a wall spot, cannot mark a
 * purchase verified, and never sees payment data. Publication happens only
 * after an admin manually verifies the purchase against Stan Store records.
 */
export const POST = guardedPost(
  claimSchema,
  { routeKey: 'preschool-claim', rateLimitMax: 5 },
  async ({ data }) => {
    // Honeypot tripped: a hidden field only bots fill. Pretend success so the
    // bot learns nothing; store nothing.
    if (data.company_website) {
      log.info('preschool_claim_honeypot', {});
      return ok({ received: true }, 201);
    }

    const supabase = createAdminClient();

    // One live claim per checkout email: block a resubmit while a claim is
    // pending, and block re-claiming an already-approved spot. (The partial
    // unique index in migration 028 backstops the pending case at the DB.)
    const { data: existing, error: lookupError } = await supabase
      .from('preschool_founding_claims')
      .select('id, status')
      .eq('purchaser_email', data.purchaser_email)
      .in('status', ['pending', 'approved'])
      .limit(1);

    // 42P01 = relation does not exist: migration 028 has not been applied yet.
    if (lookupError?.code === '42P01') {
      log.info('preschool_claim_table_missing', {});
      return fail(
        'Founding Student claims are not open yet. Check back shortly — your purchase is safe and your spot is not affected.',
        503,
        'not_open',
      );
    }
    if (existing && existing.length > 0) {
      const status = existing[0].status;
      return fail(
        status === 'approved'
          ? 'A Founding Student spot has already been verified for this email.'
          : 'A claim for this email is already in the review queue — no need to resubmit.',
        409,
        'duplicate_claim',
      );
    }

    const { data: row, error } = await supabase
      .from('preschool_founding_claims')
      .insert({
        purchaser_email: data.purchaser_email,
        display_name: data.display_name,
        is_anonymous: data.is_anonymous,
        business_name: data.business_name ?? null,
        website_url: data.website_url ?? null,
        confirmed_checkout: data.confirmed_checkout,
        consent_public_display: data.consent_public_display,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error || !row) {
      // Unique-index race on the pending email → same friendly duplicate answer.
      if (error?.code === '23505') {
        return fail(
          'A claim for this email is already in the review queue — no need to resubmit.',
          409,
          'duplicate_claim',
        );
      }
      if (error?.code === '42P01') {
        return fail(
          'Founding Student claims are not open yet. Check back shortly — your purchase is safe and your spot is not affected.',
          503,
          'not_open',
        );
      }
      log.error('preschool_claim_insert_failed', { code: error?.code });
      return fail('Could not save your claim. Try again.', 500, 'db_error');
    }

    log.info('preschool_claim_received', { id: row.id });
    return ok({ received: true }, 201);
  },
);
