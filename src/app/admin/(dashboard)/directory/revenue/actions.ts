'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { isBillingPeriod, isOfferId, getOffer, standardAmountCents } from '@/lib/directory/offers';
import {
  MAX_REASON,
  MAX_REFERENCE,
  agreedOfferNoteLine,
  appendNote,
  bounded,
  isSponsorStage,
  isoDay,
  paymentBlockers,
  paymentInstrumentBlockers,
  paymentNoteLine,
  qualificationNoteLine,
  quoteBlockers,
  readSaleState,
  renewalDateFor,
  stageNoteLine,
  stageTransitionBlockers,
  type PaymentEntry,
  type Quote,
  type SponsorSaleRow,
} from '@/lib/directory/revenue';

/**
 * Revenue console writes.
 *
 * Every action follows the same shape: admin gate → read the row as it is right
 * now → refuse on any blocker → write → append an append-only audit line and a
 * touch → revalidate. Nothing here is a toggle; each step is a separate,
 * deliberate act, and the console is arranged so that no single control can
 * take an inquiry from "arrived" to "live on the public site".
 *
 * What is NOT here matters as much as what is. There is no processor, no
 * checkout, no invoice send, no outreach, and no field anywhere that accepts a
 * card, a bank account or a credential — `paymentInstrumentBlockers` refuses
 * text that looks like one rather than storing it. Recording a payment is a
 * statement about money the owner has already seen arrive somewhere else.
 *
 * Activation itself is NOT here either: it stays on the placements console,
 * which is the one screen that writes to `locations` and `directory_sponsors`.
 * This console decides whether a deal is allowed to reach that screen.
 */

const PATH = '/admin/directory/revenue';

function back(params: Record<string, string>): never {
  redirect(`${PATH}?${new URLSearchParams(params).toString()}`);
}

/** Blockers are shown verbatim; cap the length so the URL stays usable. */
function fail(blockers: string[]): never {
  back({ err: blockers.join(' ').slice(0, 500) });
}

function field(f: FormData, key: string): string {
  return String(f.get(key) ?? '').trim();
}

const ROW_COLS =
  'id, company, stage, status, tier_interest, pledged_cents, paid_cents, next_action, next_action_date, notes';

type RawRow = {
  id: string;
  company: string | null;
  stage: string | null;
  status: string | null;
  tier_interest: string | null;
  pledged_cents: number | null;
  paid_cents: number | null;
  next_action: string | null;
  next_action_date: string | null;
  notes: string | null;
};

function toSaleRow(r: RawRow): SponsorSaleRow {
  return {
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
}

/**
 * Dollars as typed by a human → whole cents. Rejects anything that is not a
 * plain non-negative amount, so a stray minus sign or an exponent cannot become
 * a negative or absurd figure in the ledger.
 */
function dollarsToCents(value: string): number | null {
  const trimmed = value.replace(/[$,\s]/g, '');
  if (!/^\d+(?:\.\d{1,2})?$/.test(trimmed)) return null;
  return Math.round(Number(trimmed) * 100);
}

async function loadRow(
  supabase: ReturnType<typeof createAdminClient>,
  id: string,
): Promise<{ raw: RawRow; sale: ReturnType<typeof readSaleState> }> {
  const { data, error } = await supabase.from('sponsors').select(ROW_COLS).eq('id', id).single();
  if (error || !data) fail(['That opportunity could not be loaded. Nothing was changed.']);
  const raw = data as unknown as RawRow;
  return { raw, sale: readSaleState(toSaleRow(raw)) };
}

/** One append-only touch mirroring a decision. Best effort — the write stands. */
async function addTouch(
  supabase: ReturnType<typeof createAdminClient>,
  sponsorId: string,
  touchType: 'email' | 'call' | 'dm' | 'meeting' | 'video' | 'other',
  direction: 'outbound' | 'inbound',
  summary: string,
): Promise<void> {
  try {
    await supabase.from('sponsor_touches').insert({
      sponsor_id: sponsorId,
      touch_type: touchType,
      direction,
      summary: summary.slice(0, 400),
    });
  } catch {
    /* The decision already stands; the mirror is best effort. */
  }
}

/* ------------------------------------------------------------ stage moves */

/**
 * Move an opportunity one step along the pipeline. Refuses a jump: the machine
 * in `revenue.ts` allows only the next stage or a loss, so nothing can go from
 * a fresh inquiry to closed-won in a click.
 */
export async function setStageAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = field(formData, 'sponsor_id');
  const to = field(formData, 'stage');
  const by = bounded(field(formData, 'actor') || 'admin', 60);
  const reason = bounded(field(formData, 'reason'), MAX_REASON);
  if (!id) fail(['No opportunity selected.']);
  if (!isSponsorStage(to)) fail(['That is not a stage this pipeline has.']);

  const supabase = createAdminClient();
  const { raw, sale } = await loadRow(supabase, id);

  const blockers = stageTransitionBlockers(sale.stage, to, reason);
  blockers.push(...paymentInstrumentBlockers(reason, 'The note'));
  if (blockers.length) fail(blockers);

  const at = new Date();
  const line = stageNoteLine(sale.stage, to, reason, by, at);
  const patch: Record<string, unknown> = { stage: to, notes: appendNote(raw.notes, line) };
  // The admin `status` vocabulary tracks the lifecycle separately. Reaching
  // `contacted` is the only place the two agree, and only when nothing further
  // along has already been recorded.
  if (to === 'contacted' && raw.status === 'new') patch.status = 'contacted';

  const { error } = await supabase.from('sponsors').update(patch).eq('id', id);
  if (error) fail(['The update failed. Nothing was changed.']);

  await addTouch(supabase, id, 'other', 'outbound', line);
  revalidatePath(PATH);
  back({ ok: `Moved to ${to.replace('_', ' ')}.` });
}

/* ----------------------------------------------------------- next actions */

/** Set what happens next and when. The queue is only honest if this is kept. */
export async function setNextActionAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = field(formData, 'sponsor_id');
  const action = bounded(field(formData, 'next_action'), 200);
  const date = field(formData, 'next_action_date');
  const priorityRaw = field(formData, 'priority');
  if (!id) fail(['No opportunity selected.']);
  if (!action) fail(['Write what the next action actually is.']);
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) fail(['That is not a valid date.']);
  const priority = Number(priorityRaw);
  if (priorityRaw && (!Number.isInteger(priority) || priority < 1 || priority > 5))
    fail(['Priority is 1 to 5.']);
  const instrument = paymentInstrumentBlockers(action, 'The next action');
  if (instrument.length) fail(instrument);

  const supabase = createAdminClient();
  const patch: Record<string, unknown> = {
    next_action: action,
    next_action_date: date || null,
  };
  if (priorityRaw) patch.priority = priority;
  const { error } = await supabase.from('sponsors').update(patch).eq('id', id);
  if (error) fail(['The update failed. Nothing was changed.']);

  revalidatePath(PATH);
  back({ ok: 'Next action saved.' });
}

/* ----------------------------------------------------------------- touches */

/** Record a contact attempt. Append-only: it never replaces an earlier one. */
export async function addTouchAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = field(formData, 'sponsor_id');
  const type = field(formData, 'touch_type');
  const direction = field(formData, 'direction') === 'inbound' ? 'inbound' : 'outbound';
  const summary = bounded(field(formData, 'summary'), 400);
  const allowed = ['email', 'call', 'dm', 'meeting', 'video', 'other'] as const;
  if (!id) fail(['No opportunity selected.']);
  if (!(allowed as readonly string[]).includes(type)) fail(['Choose how you made contact.']);
  if (!summary) fail(['Write one line about what happened.']);
  const instrument = paymentInstrumentBlockers(summary, 'The summary');
  if (instrument.length) fail(instrument);

  const supabase = createAdminClient();
  const { error } = await supabase.from('sponsor_touches').insert({
    sponsor_id: id,
    touch_type: type,
    direction,
    summary,
  });
  if (error) fail(['The touch could not be saved.']);

  revalidatePath(PATH);
  back({ ok: 'Contact recorded.' });
}

/** Record the outcome of a qualification call as one labelled line. */
export async function recordQualificationAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = field(formData, 'sponsor_id');
  const result = bounded(field(formData, 'result'), MAX_REASON);
  const by = bounded(field(formData, 'actor') || 'admin', 60);
  if (!id) fail(['No opportunity selected.']);
  if (!result) fail(['Write what you learned on the call.']);
  const instrument = paymentInstrumentBlockers(result, 'The qualification note');
  if (instrument.length) fail(instrument);

  const supabase = createAdminClient();
  const { raw } = await loadRow(supabase, id);
  const line = qualificationNoteLine(result, by, new Date());
  const { error } = await supabase
    .from('sponsors')
    .update({ notes: appendNote(raw.notes, line) })
    .eq('id', id);
  if (error) fail(['The update failed. Nothing was changed.']);

  await addTouch(supabase, id, 'call', 'outbound', line);
  revalidatePath(PATH);
  back({ ok: 'Qualification recorded.' });
}

/* ------------------------------------------------------------- the quote */

/**
 * Record the offer, term and amount actually agreed.
 *
 * The amount is stored in `pledged_cents`; the offer in `tier_interest`; the
 * term in one labelled note line. A quote that differs from the standard price
 * needs a written reason and is recorded as an explicit figure against this one
 * deal — the offer module keeps the standard price, so a discount here can
 * never rewrite what the next business is quoted.
 */
export async function recordQuoteAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = field(formData, 'sponsor_id');
  const offerId = field(formData, 'offer_id');
  const term = field(formData, 'term');
  const by = bounded(field(formData, 'actor') || 'admin', 60);
  const reason = bounded(field(formData, 'reason'), MAX_REASON);
  if (!id) fail(['No opportunity selected.']);
  if (!isOfferId(offerId)) fail(['Choose one of the approved offers.']);
  if (!isBillingPeriod(term)) fail(['Choose monthly or annual.']);

  // A blank amount means "the standard price", which is the common case and
  // must not require retyping a figure that already lives in the authority.
  const typed = field(formData, 'amount');
  const standard = standardAmountCents(offerId, term);
  const quotedCents = typed ? dollarsToCents(typed) : standard;
  if (quotedCents === null)
    fail(['Enter the agreed amount as plain dollars, for example 999 or 999.00.']);

  const quote: Quote = { offerId, term, quotedCents, reason, recordedBy: by };
  const blockers = quoteBlockers(quote);
  if (blockers.length) fail(blockers);

  const supabase = createAdminClient();
  const { raw, sale } = await loadRow(supabase, id);
  // Quoting is part of the conversation, not the end of it. It does not move
  // the stage — the owner does that when the business actually commits.
  if (sale.stage === 'closed_lost')
    fail(['This opportunity is closed lost. Re-open it before quoting again.']);

  const at = new Date();
  const line = agreedOfferNoteLine(quote, at);
  const { error } = await supabase
    .from('sponsors')
    .update({
      tier_interest: offerId,
      pledged_cents: quotedCents,
      notes: appendNote(raw.notes, line),
    })
    .eq('id', id);
  if (error) fail(['The update failed. Nothing was changed.']);

  await addTouch(supabase, id, 'other', 'outbound', line);
  revalidatePath(PATH);
  back({ ok: `Quote recorded: ${getOffer(offerId).name}, ${term}.` });
}

/* ----------------------------------------------------------- the payment */

/**
 * Record a payment the owner has already received.
 *
 * This is the gate everything downstream leans on: no placement goes live
 * without a confirmed payment recorded here. It takes no card details, sends no
 * invoice, and contacts nobody — the reference field is for something the owner
 * already holds ("check 1042", "bank transfer 3 Aug"), and text that looks like
 * an instrument or a credential is refused outright rather than stored.
 */
export async function recordPaymentAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = field(formData, 'sponsor_id');
  const by = bounded(field(formData, 'actor') || 'admin', 60);
  const reference = bounded(field(formData, 'reference'), MAX_REFERENCE);
  const paidOn = field(formData, 'paid_on');
  const confirmed = field(formData, 'confirmed') === 'yes';
  if (!id) fail(['No opportunity selected.']);

  const typed = field(formData, 'amount');
  const paidCents = typed ? dollarsToCents(typed) : null;
  if (paidCents === null)
    fail(['Enter the amount received as plain dollars, for example 999 or 999.00.']);

  const supabase = createAdminClient();
  const { raw, sale } = await loadRow(supabase, id);
  if (sale.offerId === null || sale.quotedCents <= 0)
    fail(['Record the agreed offer and amount before recording a payment.']);
  if (sale.term === null) fail(['Record the agreed term before recording a payment.']);

  const entry: PaymentEntry = { paidCents, paidOn, confirmed, reference, recordedBy: by };
  const blockers = paymentBlockers(
    { offerId: sale.offerId, term: sale.term, quotedCents: sale.quotedCents },
    entry,
    new Date(),
  );
  if (blockers.length) fail(blockers);

  const at = new Date();
  const line = paymentNoteLine(entry, at);
  const { error } = await supabase
    .from('sponsors')
    .update({
      paid_cents: paidCents,
      status: 'paid',
      notes: appendNote(raw.notes, line),
      next_action: 'Activate the placement that was paid for',
      next_action_date: isoDay(at),
    })
    .eq('id', id);
  if (error) fail(['The update failed. Nothing was changed.']);

  await addTouch(supabase, id, 'other', 'inbound', line);
  revalidatePath(PATH);
  revalidatePath('/admin/directory/placements');
  back({
    ok: 'Payment recorded. The placement can now be activated on the placements console.',
  });
}

/* -------------------------------------------------- renewal bookkeeping */

/**
 * Set or correct the term end recorded against a live placement. This is what
 * the renewal queue reads, and for a featured listing it is the ONLY thing that
 * says when the placement should stop — the column behind it cannot expire.
 */
export async function setRenewalAction(formData: FormData): Promise<void> {
  requireAdmin();
  const id = field(formData, 'sponsor_id');
  const startDay = field(formData, 'starts_on');
  if (!id) fail(['No opportunity selected.']);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDay)) fail(['Enter the date the term started.']);

  const supabase = createAdminClient();
  const { sale } = await loadRow(supabase, id);
  if (sale.offerId === null || sale.term === null)
    fail(['Record the agreed offer and term before setting a renewal date.']);

  const end = renewalDateFor(startDay, sale.term);
  const offer = getOffer(sale.offerId);
  const { error } = await supabase
    .from('sponsors')
    .update({
      next_action: offer.autoExpires
        ? `Renew ${offer.name} before it lapses`
        : `Stop or renew ${offer.name} — it will NOT lapse on its own`,
      next_action_date: end,
    })
    .eq('id', id);
  if (error) fail(['The update failed. Nothing was changed.']);

  revalidatePath(PATH);
  back({ ok: `Term recorded: ${startDay} to ${end}.` });
}
