import { guardedPost } from '@/lib/api/handler';
import { leadCaptureSchema } from '@/lib/api/schemas';
import { mergeLead } from '@/lib/leads/funnel';
import { createAdminClient } from '@/lib/supabase/admin';
import { ok, fail } from '@/lib/api/responses';
import { log } from '@/lib/api/logger';

export const runtime = 'nodejs';

/**
 * Lead capture. Upserts by email (repeat submits don't error), then optionally
 * records a magnet claim. The lead_magnet_claims PK (lead_id, magnet_id) makes
 * claiming the same magnet twice a no-op instead of a break.
 */
export const POST = guardedPost(
  leadCaptureSchema,
  { routeKey: 'lead', rateLimitMax: 8 },
  async ({ data }) => {
    const supabase = createAdminClient();

    // First-touch attribution: a repeat signup must never overwrite where the
    // lead ORIGINALLY came from (source/utm). Read-then-write instead of a
    // blind upsert; mergeLead fills only missing fields (sms consent
    // true-wins).
    const { data: existing } = await supabase
      .from('leads')
      .select('id, first_name, phone, sms_consent, source, utm')
      .eq('email', data.email)
      .maybeSingle();

    let lead: { id: string } | null = null;
    let error: { code?: string } | null = null;

    if (existing) {
      const update = mergeLead(existing, {
        first_name: data.first_name ?? null,
        phone: data.phone || null,
        sms_consent: data.sms_consent,
        source: data.source ?? null,
        utm: data.utm,
      });
      if (Object.keys(update).length > 0) {
        const res = await supabase.from('leads').update(update).eq('id', existing.id);
        error = res.error;
      }
      lead = { id: existing.id };
    } else {
      const res = await supabase
        .from('leads')
        .insert({
          email: data.email,
          first_name: data.first_name ?? null,
          phone: data.phone || null,
          sms_consent: data.sms_consent,
          source: data.source ?? null,
          utm: data.utm,
        })
        .select('id')
        .single();
      lead = res.data;
      // Lost race with a concurrent insert of the same email: fall back to
      // the existing row instead of failing the signup.
      if (res.error?.code === '23505') {
        const again = await supabase
          .from('leads')
          .select('id')
          .eq('email', data.email)
          .maybeSingle();
        lead = again.data;
      } else {
        error = res.error;
      }
    }

    if (error || !lead) {
      log.error('lead_upsert_failed', { code: error?.code });
      return fail('Could not save your info. Try again.', 500, 'db_error');
    }

    if (data.magnet_slug) {
      const { data: magnet } = await supabase
        .from('lead_magnets')
        .select('id')
        .eq('slug', data.magnet_slug)
        .eq('is_active', true)
        .maybeSingle();

      if (magnet) {
        await supabase
          .from('lead_magnet_claims')
          .upsert({ lead_id: lead.id, magnet_id: magnet.id }, { onConflict: 'lead_id,magnet_id' });
      }
    }

    log.info('lead_captured', { lead_id: lead.id, source: data.source });
    // Delivery email intentionally NOT sent (Milestone 4: dormant).
    return ok({ lead_id: lead.id }, 201);
  },
);
