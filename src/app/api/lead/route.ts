import { guardedPost } from '@/lib/api/handler';
import { leadCaptureSchema } from '@/lib/api/schemas';
import { createAdminClient } from '@/lib/supabase/admin';
import { ok, fail } from '@/lib/api/responses';
import { log } from '@/lib/api/logger';
import { resolveConsentGrant } from '@/lib/leads/sms-consent';
import { recordSmsConsent } from '@/lib/leads/sms-consent-server';
import { buildLeadInsert, buildLeadPatch, isNoOpPatch } from '@/lib/leads/merge';

export const runtime = 'nodejs';

/**
 * Lead capture. Insert-or-merge by email, then optionally record a magnet
 * claim. The lead_magnet_claims PK (lead_id, magnet_id) makes claiming the
 * same magnet twice a no-op instead of a break.
 *
 * NO LONGER A BLIND UPSERT. It used to write a whole row every time, so a form
 * that never asked for a field still wrote `null` over it — a newsletter signup
 * erased the name, phone, first-touch campaign and acquisition source of an
 * existing founder lead. A new address is inserted whole; an existing one gets
 * an UPDATE containing only the columns that submission actually collected, so
 * untouched columns are not merely rewritten with the same value but never
 * appear in the statement at all. See lib/leads/merge.ts for the policy.
 *
 * FAIL-CLOSED SMS consent: the founder form is the only lead source that shows
 * the SMS opt-in. `leads.sms_consent` is set to `true` ONLY after a durable
 * evidence row is recorded for that submission — and is never set to `false` by
 * a form that did not ask, which would silently revoke a real opt-in and leave
 * the flag contradicting the evidence log.
 */
export const POST = guardedPost(
  leadCaptureSchema,
  { routeKey: 'lead', rateLimitMax: 8 },
  async ({ data }) => {
    const supabase = createAdminClient();

    // Record consent evidence BEFORE the upsert so the stored flag can fail
    // closed. Evidence (and the opt-in checkbox) exists only for the founder
    // form; every other source is stored as not-consented by construction.
    let granted = false;
    if (data.source === 'founder') {
      const consentRequested = data.sms_consent === true;
      const durable = await recordSmsConsent({
        sourceForm: 'founder-lead',
        email: data.email,
        phone: data.phone || null,
        consent: consentRequested,
        submissionId: data.submission_id,
      });
      granted = resolveConsentGrant(consentRequested, durable);
    }

    // Only the founder form asks about SMS, so only it may move the flag.
    // Everywhere else this stays undefined — "did not ask", not "declined".
    const smsConsentGranted = data.source === 'founder' ? granted : undefined;

    const existing = await supabase
      .from('leads')
      .select('id')
      .eq('email', data.email)
      .maybeSingle();

    // A read failure is not "no such lead" — treating it as one would insert a
    // duplicate or, worse, take the insert path and lose the merge guarantee.
    if (existing.error) {
      log.error('lead_lookup_failed', { code: existing.error.code });
      return fail('Could not save your info. Try again.', 500, 'db_error');
    }

    let leadId: string | undefined = existing.data?.id;

    if (leadId) {
      const patch = buildLeadPatch({
        firstName: data.first_name,
        phone: data.phone,
        smsConsentGranted,
      });
      // A repeat signup that carries nothing new writes nothing at all —
      // idempotent by construction, and `updated_at` stays honest.
      if (!isNoOpPatch(patch)) {
        const { error } = await supabase.from('leads').update(patch).eq('id', leadId);
        if (error) {
          log.error('lead_update_failed', { code: error.code });
          return fail('Could not save your info. Try again.', 500, 'db_error');
        }
      }
    } else {
      const inserted = await supabase
        .from('leads')
        .insert(
          buildLeadInsert({
            email: data.email,
            firstName: data.first_name,
            phone: data.phone,
            smsConsentGranted,
            source: data.source,
            utm: data.utm,
          }),
        )
        .select('id')
        .single();

      if (inserted.error) {
        // 23505 = someone inserted this address between our read and write.
        // Their row is the first touch; adopt it and merge into it rather than
        // failing a submission that is, from the driver's side, perfectly fine.
        if (inserted.error.code === '23505') {
          const retry = await supabase
            .from('leads')
            .select('id')
            .eq('email', data.email)
            .maybeSingle();
          if (retry.error || !retry.data) {
            log.error('lead_insert_race_unresolved', { code: retry.error?.code });
            return fail('Could not save your info. Try again.', 500, 'db_error');
          }
          leadId = retry.data.id;
          const patch = buildLeadPatch({
            firstName: data.first_name,
            phone: data.phone,
            smsConsentGranted,
          });
          if (!isNoOpPatch(patch)) {
            const { error } = await supabase.from('leads').update(patch).eq('id', leadId);
            if (error) {
              log.error('lead_update_failed', { code: error.code });
              return fail('Could not save your info. Try again.', 500, 'db_error');
            }
          }
        } else {
          log.error('lead_insert_failed', { code: inserted.error.code });
          return fail('Could not save your info. Try again.', 500, 'db_error');
        }
      } else {
        leadId = inserted.data.id;
      }
    }

    if (!leadId) {
      log.error('lead_write_no_id', {});
      return fail('Could not save your info. Try again.', 500, 'db_error');
    }
    const lead = { id: leadId };

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
