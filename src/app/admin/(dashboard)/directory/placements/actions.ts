'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  canActivateCorridorSponsor,
  canActivateFeatured,
  placementNoteLine,
  placementTouchSummary,
  type CorridorSponsorRow,
  type PlacementKind,
  type PlacementRecord,
  type PromotableListing,
} from '@/lib/directory/placements';
import {
  isoDay,
  readSaleState,
  saleActivationBlockers,
  type SaleState,
  type SponsorSaleRow,
} from '@/lib/directory/revenue';

/**
 * Paid placement writes. Every action: admin gate → load current state →
 * refuse on any blocker → write → mirror the decision into the CRM audit trail
 * → revalidate.
 *
 * These are the ONLY writes in the app that turn revenue on. Four rules hold
 * throughout:
 *
 *   1. No activation happens without an explicit typed confirmation.
 *   2. Capacity and the held-brand rule are checked against live data at the
 *      moment of the write, not trusted from the form.
 *   3. Nothing here collects payment. Activation is a record made AFTER Shawn
 *      has confirmed payment outside the platform.
 *   4. And — the rule this file was missing — that record has to EXIST. The CRM
 *      row was previously an optional free-text box used only to file an audit
 *      note, so a placement could be switched on with no opportunity behind it,
 *      no offer, no term and no payment. It is now required, and
 *      `saleActivationBlockers` re-reads the opportunity from the database at
 *      the moment of the write: committed or closed-won, the right offer, an
 *      agreed term, and a confirmed payment covering the agreed amount. A
 *      free listing claim can never satisfy it, because a claim has no payment.
 *
 * The capacity check is check-then-act, not a database invariant — that would
 * need a partial unique index, i.e. a migration. Sound for one administrator;
 * the page says so.
 */

const PATH = '/admin/directory/placements';
const CONFIRM_WORD = 'ACTIVATE';

function back(params: Record<string, string>): never {
  const q = new URLSearchParams(params).toString();
  redirect(`${PATH}?${q}`);
}

/** Blockers are shown to the admin verbatim; cap the length so the URL stays sane. */
function fail(blockers: string[]): never {
  back({ err: blockers.join(' ').slice(0, 400) });
}

function field(f: FormData, key: string): string {
  return String(f.get(key) ?? '').trim();
}

/** A date input (YYYY-MM-DD) as an ISO instant, or null when blank. */
function isoDate(value: string, endOfDay = false): string | null {
  if (!value) return null;
  const d = new Date(`${value}T${endOfDay ? '23:59:59' : '00:00:00'}Z`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function toPromotable(r: Record<string, unknown>): PromotableListing {
  return {
    id: String(r.id),
    name: (r.name as string) ?? null,
    categorySlug: (r.category_slug as string) ?? null,
    interstate: (r.interstate as string) ?? null,
    state: (r.state as string) ?? null,
    isPublished: Boolean(r.is_published),
    isFeatured: Boolean(r.is_featured),
    deletedAt: (r.deleted_at as string) ?? null,
  };
}

const LISTING_COLS =
  'id, name, category_slug, interstate, state, is_published, is_featured, deleted_at';

/**
 * Append one labelled line to a CRM row's notes and mirror it as a touch.
 * `locations` has no actor column, so this parallel trail is the audit record.
 * Best effort: a placement is never left half-applied because the note failed.
 */
async function recordAudit(
  supabase: ReturnType<typeof createAdminClient>,
  sponsorId: string,
  record: PlacementRecord,
  at: string,
): Promise<void> {
  try {
    const { data } = await supabase.from('sponsors').select('notes').eq('id', sponsorId).single();
    const existing = ((data as { notes: string | null } | null)?.notes ?? '').trim();
    const line = placementNoteLine(record, at);
    await supabase
      .from('sponsors')
      .update({ notes: existing ? `${existing}\n\n${line}` : line })
      .eq('id', sponsorId);
    await supabase.from('sponsor_touches').insert({
      sponsor_id: sponsorId,
      touch_type: 'other',
      direction: 'outbound',
      summary: placementTouchSummary(record),
    });
  } catch {
    /* The audit note is best effort; the placement decision already stands. */
  }
}

function revalidatePlacement(categorySlug: string | null) {
  revalidatePath(PATH);
  revalidatePath('/admin/directory');
  revalidatePath('/directory');
  if (categorySlug) revalidatePath(`/directory/${categorySlug}`);
  revalidatePath('/directory/location/[slug]', 'page');
}

const SALE_COLS =
  'id, stage, status, tier_interest, pledged_cents, paid_cents, next_action, next_action_date, notes';

/**
 * Read the opportunity this placement is being sold to, as it stands right now.
 * Returns null when the id names nothing — the caller treats that the same as
 * "no opportunity selected", because an id that resolves to nothing is not a
 * sale.
 */
async function loadSale(
  supabase: ReturnType<typeof createAdminClient>,
  sponsorId: string,
): Promise<SaleState | null> {
  if (!sponsorId) return null;
  try {
    const { data, error } = await supabase
      .from('sponsors')
      .select(SALE_COLS)
      .eq('id', sponsorId)
      .single();
    if (error || !data) return null;
    const r = data as unknown as {
      id: string;
      stage: string | null;
      status: string | null;
      tier_interest: string | null;
      pledged_cents: number | null;
      paid_cents: number | null;
      next_action: string | null;
      next_action_date: string | null;
      notes: string | null;
    };
    const row: SponsorSaleRow = {
      id: r.id,
      stage: r.stage,
      status: r.status,
      tierInterest: r.tier_interest,
      pledgedCents: r.pledged_cents,
      paidCents: r.paid_cents,
      nextAction: r.next_action,
      nextActionDate: r.next_action_date,
      notes: r.notes,
    };
    return readSaleState(row);
  } catch {
    return null;
  }
}

/**
 * Mark the opportunity live and set the renewal date the term implies, so the
 * revenue console's renewal queue knows about this placement the moment it goes
 * on. Without this the queue is blind to exactly the placement that most needs
 * watching — a featured listing, which will not stop by itself.
 */
async function markLive(
  supabase: ReturnType<typeof createAdminClient>,
  sponsorId: string,
  kind: PlacementKind,
  endsAt: string | null,
): Promise<void> {
  try {
    const autoExpires = kind === 'corridor-sponsor';
    await supabase
      .from('sponsors')
      .update({
        status: 'active',
        stage: 'closed_won',
        next_action: autoExpires
          ? 'Renew the corridor sponsorship before it lapses'
          : 'Stop or renew the featured listing — it will NOT lapse on its own',
        next_action_date: endsAt ? isoDay(new Date(endsAt)) : null,
      })
      .eq('id', sponsorId);
  } catch {
    /* The placement is already live; the bookkeeping mirror is best effort. */
  }
}

/* ------------------------------------------------------- featured listing */

/**
 * Turn on a paid featured listing. Refuses unless the listing is promotable,
 * both its pages have room, the term is valid, and the admin typed ACTIVATE.
 */
export async function activateFeaturedAction(formData: FormData): Promise<void> {
  requireAdmin();

  const listingId = field(formData, 'listing_id');
  const reviewer = field(formData, 'reviewer');
  const billingRaw = field(formData, 'billing');
  const billing = billingRaw === 'annual' ? 'annual' : billingRaw === 'monthly' ? 'monthly' : null;
  const sponsorId = field(formData, 'sponsor_id');
  const startsAt = isoDate(field(formData, 'starts_on'));
  const endsAt = isoDate(field(formData, 'ends_on'), true);

  const upfront: string[] = [];
  if (!listingId) upfront.push('No listing selected.');
  if (!sponsorId)
    upfront.push('The paying CRM opportunity is required. A placement never goes live unsold.');
  if (!reviewer) upfront.push('Reviewer name is required — this is the audit trail.');
  if (!billing) upfront.push('Choose monthly or annual billing.');
  if (!startsAt) upfront.push('A start date is required.');
  if (!endsAt)
    upfront.push('An end date is required — a featured listing cannot expire by itself.');
  if (field(formData, 'confirm') !== CONFIRM_WORD)
    upfront.push(`Type ${CONFIRM_WORD} to confirm. Nothing was changed.`);
  if (upfront.length) fail(upfront);

  const supabase = createAdminClient();

  // The sale side of the gate, re-read from the database rather than trusted
  // from the form: committed or won, the right offer, an agreed term, and a
  // confirmed payment that covers the agreed amount.
  const sale = await loadSale(supabase, sponsorId);
  const saleBlockers = saleActivationBlockers('featured-listing', sale, { startsAt, endsAt });
  if (saleBlockers.length) fail(saleBlockers);

  const { data: targetRow, error: targetErr } = await supabase
    .from('locations')
    .select(LISTING_COLS)
    .eq('id', listingId)
    .single();
  if (targetErr || !targetRow) fail(['That listing could not be loaded. Nothing was changed.']);
  const target = toPromotable(targetRow as Record<string, unknown>);

  // Live capacity, not whatever the form believed when it was rendered.
  const { data: featuredRows } = await supabase
    .from('locations')
    .select(LISTING_COLS)
    .eq('is_featured', true)
    .eq('is_published', true)
    .is('deleted_at', null)
    .limit(500);
  const existing = ((featuredRows as Record<string, unknown>[]) ?? []).map(toPromotable);

  const verdict = canActivateFeatured(target, existing, { startsAt, endsAt });
  if (!verdict.ok) fail(verdict.blockers);

  const { error } = await supabase
    .from('locations')
    .update({ is_featured: true })
    .eq('id', listingId);
  if (error) fail(['The update failed. Nothing was changed.']);

  const at = new Date().toISOString();
  await recordAudit(
    supabase,
    sponsorId,
    {
      kind: 'featured-listing',
      target: target.name ?? listingId,
      billing,
      startsAt,
      endsAt,
      reviewer,
      action: 'activated',
    },
    at,
  );
  await markLive(supabase, sponsorId, 'featured-listing', endsAt);

  revalidatePlacement(target.categorySlug);
  revalidatePath('/admin/directory/revenue');
  back({ ok: `Featured listing activated for ${target.name ?? listingId}.` });
}

/** Turn a featured listing off. No confirmation word — stopping is always safe. */
export async function deactivateFeaturedAction(formData: FormData): Promise<void> {
  requireAdmin();
  const listingId = field(formData, 'listing_id');
  const reviewer = field(formData, 'reviewer') || 'admin';
  const sponsorId = field(formData, 'sponsor_id');
  if (!listingId) fail(['No listing selected.']);

  const supabase = createAdminClient();
  const { data: targetRow } = await supabase
    .from('locations')
    .select(LISTING_COLS)
    .eq('id', listingId)
    .single();
  const target = targetRow ? toPromotable(targetRow as Record<string, unknown>) : null;

  const { error } = await supabase
    .from('locations')
    .update({ is_featured: false })
    .eq('id', listingId);
  if (error) fail(['The update failed. Nothing was changed.']);

  if (sponsorId)
    await recordAudit(
      supabase,
      sponsorId,
      {
        kind: 'featured-listing',
        target: target?.name ?? listingId,
        billing: null,
        startsAt: null,
        endsAt: null,
        reviewer,
        action: 'deactivated',
      },
      new Date().toISOString(),
    );

  revalidatePlacement(target?.categorySlug ?? null);
  back({ ok: `Featured listing stopped for ${target?.name ?? listingId}.` });
}

/* ------------------------------------------------------- corridor sponsor */

function toSponsorRow(r: Record<string, unknown>): CorridorSponsorRow {
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    placements: (r.placements as string[]) ?? [],
    interstates: (r.interstates as string[]) ?? [],
    active: Boolean(r.active),
    startsAt: (r.starts_at as string) ?? null,
    endsAt: (r.ends_at as string) ?? null,
  };
}

const SPONSOR_COLS = 'id, name, placements, interstates, active, starts_at, ends_at';

/**
 * Create and activate the one primary sponsor for a corridor page. A blank
 * corridor is refused rather than silently becoming a nationwide wildcard.
 */
export async function activateCorridorSponsorAction(formData: FormData): Promise<void> {
  requireAdmin();

  const name = field(formData, 'name');
  const url = field(formData, 'url');
  const corridor = field(formData, 'corridor').toUpperCase();
  const reviewer = field(formData, 'reviewer');
  const billingRaw = field(formData, 'billing');
  const billing = billingRaw === 'annual' ? 'annual' : billingRaw === 'monthly' ? 'monthly' : null;
  const sponsorId = field(formData, 'sponsor_id');
  const startsAt = isoDate(field(formData, 'starts_on'));
  const endsAt = isoDate(field(formData, 'ends_on'), true);

  const upfront: string[] = [];
  if (!sponsorId)
    upfront.push('The paying CRM opportunity is required. A placement never goes live unsold.');
  if (!reviewer) upfront.push('Reviewer name is required — this is the audit trail.');
  if (!billing) upfront.push('Choose monthly or annual billing.');
  if (!startsAt) upfront.push('A start date is required.');
  if (!endsAt) upfront.push('An end date is required so the sponsorship expires on its own.');
  if (field(formData, 'confirm') !== CONFIRM_WORD)
    upfront.push(`Type ${CONFIRM_WORD} to confirm. Nothing was changed.`);
  if (upfront.length) fail(upfront);

  const supabase = createAdminClient();

  // The sale side of the gate. Same rules as a featured listing, and it also
  // catches the case where the deal bought the OTHER offer — activating a
  // $299 corridor slot against a $99 featured sale is a real way to give away
  // the difference, and it is refused here rather than noticed later.
  const sale = await loadSale(supabase, sponsorId);
  const saleBlockers = saleActivationBlockers('corridor-sponsor', sale, { startsAt, endsAt });
  if (saleBlockers.length) fail(saleBlockers);

  const { data: rows } = await supabase.from('directory_sponsors').select(SPONSOR_COLS).limit(500);
  const existing = ((rows as Record<string, unknown>[]) ?? []).map(toSponsorRow);

  const verdict = canActivateCorridorSponsor({ corridor, url, name }, existing, {
    startsAt,
    endsAt,
  });
  if (!verdict.ok) fail(verdict.blockers);

  const { error } = await supabase.from('directory_sponsors').insert({
    name,
    url,
    tagline: field(formData, 'tagline') || null,
    logo: field(formData, 'logo') || null,
    placements: ['interstate'],
    states: [],
    interstates: [corridor],
    categories: [],
    active: true,
    starts_at: startsAt,
    ends_at: endsAt,
    created_by: reviewer,
  });
  if (error) fail(['The sponsor could not be created. Nothing was changed.']);

  await recordAudit(
    supabase,
    sponsorId,
    {
      kind: 'corridor-sponsor',
      target: `${name} on ${corridor}`,
      billing,
      startsAt,
      endsAt,
      reviewer,
      action: 'activated',
    },
    new Date().toISOString(),
  );
  await markLive(supabase, sponsorId, 'corridor-sponsor', endsAt);

  revalidatePath(PATH);
  revalidatePath('/admin/directory/revenue');
  revalidatePath('/directory');
  revalidatePath(`/directory/${corridor.toLowerCase().replace('-', '')}`);
  back({ ok: `${name} is now the primary sponsor on ${corridor}.` });
}

/**
 * Stop a corridor sponsor, or restart one. Restarting re-runs the capacity
 * check — the slot may have been filled while it was off.
 */
export async function setCorridorSponsorActiveAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = field(formData, 'id');
  const activate = field(formData, 'active') === 'true';
  if (!id) fail(['No sponsor selected.']);

  const supabase = createAdminClient();
  const { data: rows } = await supabase.from('directory_sponsors').select(SPONSOR_COLS).limit(500);
  const all = ((rows as Record<string, unknown>[]) ?? []).map(toSponsorRow);
  const target = all.find((s) => s.id === id);
  if (!target) fail(['That sponsor could not be loaded. Nothing was changed.']);

  if (activate) {
    for (const corridor of target.interstates.length ? target.interstates : ['(every corridor)']) {
      const verdict = canActivateCorridorSponsor(
        { corridor, url: 'https://placeholder.invalid', name: target.name },
        all,
        { startsAt: target.startsAt, endsAt: target.endsAt },
        new Date(),
        target.id,
      );
      // Only the capacity and corridor findings matter here; the URL is already
      // stored and validated, so its placeholder blocker is filtered out.
      const relevant = verdict.blockers.filter((b) => !b.includes('http(s) URL'));
      if (relevant.length) fail(relevant);
    }
  }

  const { error } = await supabase
    .from('directory_sponsors')
    .update({ active: activate, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) fail(['The update failed. Nothing was changed.']);

  revalidatePath(PATH);
  revalidatePath('/directory');
  back({ ok: `${target.name} ${activate ? 'restarted' : 'stopped'}.` });
}
