import { NextRequest } from 'next/server';
import { ok, fail } from '@/lib/api/responses';
import { log } from '@/lib/api/logger';

export const runtime = 'nodejs';

/**
 * Stripe webhook — PLACEHOLDER (Milestone 4: no Stripe links, no live payments).
 * When Stripe is wired (post-EIN), this will:
 *   1. verify the Stripe signature against STRIPE_WEBHOOK_SECRET
 *   2. on checkout.session.completed, insert a paid row into `founders`
 *   3. trigger on-demand revalidation of /founders
 * For now it acknowledges receipt without acting, and never trusts an
 * unverified body. Returns 200 so Stripe test pings don't retry-storm.
 */
export async function POST(req: NextRequest) {
  const signature = req.headers.get('stripe-signature');
  const secret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!secret) {
    log.info('stripe_webhook_placeholder_hit', { hasSignature: Boolean(signature) });
    return ok({ received: true, handled: false, reason: 'placeholder' });
  }

  // Signature verification will go here once the Stripe SDK is added.
  if (!signature) {
    log.warn('stripe_webhook_missing_signature');
    return fail('Missing signature.', 400, 'no_signature');
  }

  log.info('stripe_webhook_received_unhandled');
  return ok({ received: true, handled: false });
}
