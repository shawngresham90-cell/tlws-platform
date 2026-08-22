import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { OFFERS, priceLabel, getOffer } from '@/lib/directory/offers';
import {
  FEATURED_PER_PAGE,
  PRIMARY_CORRIDOR_SPONSORS,
  featuredUsage,
  isHeldBrand,
  promotionBlockers,
  windowStatus,
  type CorridorSponsorRow,
  type PromotableListing,
} from '@/lib/directory/placements';
import { adminFeaturedSchema } from '@/lib/admin/featured-schema';
import {
  FEATURED_STATUS_LABEL,
  featuredWindowStatus,
  type FeaturedSchema,
  type FeaturedTerm,
} from '@/lib/directory/featured-window';
import {
  featuredActivationChecklist,
  matchFeaturedOpportunity,
  placementLiveView,
  renewalEffect,
  type ActivationChecklist,
} from '@/lib/directory/first-sale';
import {
  STAGE_LABEL,
  readSaleState,
  type SaleState,
  type SponsorSaleRow,
} from '@/lib/directory/revenue';
import {
  activateCorridorSponsorAction,
  activateFeaturedAction,
  deactivateFeaturedAction,
  renewFeaturedAction,
  setCorridorSponsorActiveAction,
} from './actions';

/**
 * Paid placement console. The one screen where revenue is switched on, and the
 * only one that enforces the approved capacity: one primary sponsor per
 * corridor page, up to three sponsored listings per category or corridor page.
 *
 * Two different mechanisms are managed here because paid placement is served by
 * two: `locations.is_featured` for a featured listing, and a
 * `directory_sponsors` row for a corridor sponsor. Their behaviour differs in
 * one way that matters commercially and is stated on the page — a corridor
 * sponsor expires by itself, and since REVENUE-2 a featured listing does too —
 * but only once migration 057 has given it a term. Until then this page says so
 * and refuses to activate one.
 *
 * Nothing here takes payment. Activation is a record made after Shawn has
 * confirmed payment outside the platform.
 */

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Admin — Placements', robots: { index: false, follow: false } };

const LISTING_COLS_BASE =
  'id, name, category_slug, interstate, state, city, detail_slug, is_published, is_featured, deleted_at';

function listingCols(schema: FeaturedSchema): string {
  return schema === 'ready' ? `${LISTING_COLS_BASE}, featured_until` : LISTING_COLS_BASE;
}
const SPONSOR_COLS = 'id, name, tagline, url, placements, interstates, active, starts_at, ends_at';

/**
 * The CRM columns the sale side of the gate reads. Loaded HERE, on the console
 * that activates, rather than left for the operator to carry across from the
 * revenue console as a pasted UUID — which is what this page asked for before
 * and is the single largest way a first sale goes wrong.
 */
const SALE_COLS =
  'id, company, stage, status, tier_interest, pledged_cents, paid_cents, next_action, next_action_date, notes';

/** A CRM opportunity as the picker and the checklist need it. */
type Opportunity = { id: string; company: string; sale: SaleState; notes: string | null };

function toOpportunity(r: Record<string, unknown>): Opportunity {
  const row: SponsorSaleRow = {
    id: String(r.id),
    stage: (r.stage as string) ?? null,
    status: (r.status as string) ?? null,
    tierInterest: (r.tier_interest as string) ?? null,
    pledgedCents: (r.pledged_cents as number) ?? null,
    paidCents: (r.paid_cents as number) ?? null,
    nextAction: (r.next_action as string) ?? null,
    nextActionDate: (r.next_action_date as string) ?? null,
    notes: (r.notes as string) ?? null,
  };
  return {
    id: row.id,
    company: String(r.company ?? '(unnamed opportunity)'),
    sale: readSaleState(row),
    notes: row.notes,
  };
}

type ListingRow = PromotableListing & { city: string | null; detailSlug: string | null };

function toListing(r: Record<string, unknown>): ListingRow {
  return {
    id: String(r.id),
    name: (r.name as string) ?? null,
    categorySlug: (r.category_slug as string) ?? null,
    interstate: (r.interstate as string) ?? null,
    state: (r.state as string) ?? null,
    city: (r.city as string) ?? null,
    detailSlug: (r.detail_slug as string) ?? null,
    isPublished: Boolean(r.is_published),
    isFeatured: Boolean(r.is_featured),
    featuredUntil: (r.featured_until as string | null | undefined) ?? undefined,
    deletedAt: (r.deleted_at as string) ?? null,
  };
}

function toSponsor(r: Record<string, unknown>): CorridorSponsorRow & {
  tagline: string | null;
  url: string;
} {
  return {
    id: String(r.id),
    name: String(r.name ?? ''),
    tagline: (r.tagline as string) ?? null,
    url: String(r.url ?? ''),
    placements: (r.placements as string[]) ?? [],
    interstates: (r.interstates as string[]) ?? [],
    active: Boolean(r.active),
    startsAt: (r.starts_at as string) ?? null,
    endsAt: (r.ends_at as string) ?? null,
  };
}

/**
 * A UUID, or ''. The `?listing=` / `?sale=` parameters are operator-supplied and
 * go straight into a filter, so they are shape-checked before they are used —
 * PostgREST would reject a malformed uuid with a 400 the page would render as
 * "could not read", which reads like an outage rather than a typo.
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidOrEmpty = (v: string) => (UUID_RE.test(v) ? v : '');

async function load(query: string, targetId: string, schema: FeaturedSchema) {
  try {
    const supabase = createAdminClient();
    const [featured, sponsors, matches, opportunities, target] = await Promise.all([
      supabase
        .from('locations')
        .select(listingCols(schema))
        .eq('is_featured', true)
        .is('deleted_at', null)
        .limit(200),
      supabase.from('directory_sponsors').select(SPONSOR_COLS).limit(200),
      query
        ? supabase
            .from('locations')
            .select(listingCols(schema))
            .ilike('name', `%${query}%`)
            .eq('is_published', true)
            .is('deleted_at', null)
            .order('name')
            .limit(20)
        : Promise.resolve({ data: [] as Record<string, unknown>[] }),
      // Featured-listing opportunities at ANY stage, not only the activatable
      // ones. An operator whose deal is in the wrong stage needs to see it in
      // the picker and read why it is refused; an empty picker would leave them
      // guessing whether the row exists at all.
      supabase
        .from('sponsors')
        .select(SALE_COLS)
        .eq('tier_interest', 'featured-listing')
        .order('created_at', { ascending: false })
        .limit(50),
      // The listing under review is loaded by id rather than taken from the
      // search results: the checklist has to read the row as it stands NOW,
      // and a deleted or unpublished row never appears in `matches` at all.
      targetId
        ? supabase.from('locations').select(listingCols(schema)).eq('id', targetId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    const targetRow = target.data as unknown as Record<string, unknown> | null;
    return {
      ok: true,
      featured: ((featured.data as unknown as Record<string, unknown>[] | null) ?? []).map(
        toListing,
      ),
      sponsors: ((sponsors.data as Record<string, unknown>[]) ?? []).map(toSponsor),
      matches: ((matches.data as unknown as Record<string, unknown>[] | null) ?? []).map(toListing),
      opportunities: (
        (opportunities.data as unknown as Record<string, unknown>[] | null) ?? []
      ).map(toOpportunity),
      target: targetRow ? toListing(targetRow) : null,
    };
  } catch {
    return { ok: false, featured: [], sponsors: [], matches: [], opportunities: [], target: null };
  }
}

// 44px minimum on every control, matching the revenue console.
//
// Found by the REVENUE-2 browser bench: the buttons on this page measured 30px
// and the inputs 38px, under the touch target the owner actually works from —
// this console gets used on a phone between calls, not only at a desk. The
// revenue console was raised to 44px in REVENUE-1 and this page was missed;
// REVENUE-2 then added a Renew form to it, so the gap is now this milestone's
// to close rather than someone else's to inherit.
const input =
  'min-h-[44px] w-full rounded-card border border-line bg-asphalt px-3 py-2 text-sm text-ink';
const label = 'block text-xs text-muted';
const btn =
  'min-h-[44px] rounded-card bg-signal px-4 py-2 font-display text-sm uppercase tracking-wide text-asphalt hover:bg-signal-600';
const btnGhost =
  'min-h-[44px] rounded-card border border-line px-3 py-2 text-xs text-ink hover:border-signal';

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (iso: string | null) => (iso ? iso.slice(0, 10) : '—');

/**
 * One checklist line.
 *
 * The mark is a WORD as well as a symbol. A tick and a cross differing only by
 * glyph and colour is the failure mode this whole console is meant to avoid —
 * the operator is reading it on a phone, in a hurry, having just taken money.
 */
function GateLine({ gate }: { gate: ActivationChecklist['gates'][number] }) {
  const tone =
    gate.state === 'blocked'
      ? 'text-diesel-300'
      : gate.state === 'attention'
        ? 'text-signal'
        : 'text-ink';
  const mark = gate.state === 'blocked' ? 'NO' : gate.state === 'attention' ? 'READ' : 'OK';
  return (
    <li className="flex gap-3 border-t border-line py-2 first:border-t-0">
      <span
        className={`mt-0.5 w-12 shrink-0 text-[10px] font-bold uppercase tracking-widest ${tone}`}
      >
        {mark}
      </span>
      <span className="min-w-0">
        <span className={`block text-sm font-semibold ${tone}`}>{gate.label}</span>
        <span className="block break-words text-xs text-muted">{gate.detail}</span>
      </span>
    </li>
  );
}

/** The opportunity picker. Replaces a free-text box that asked for a UUID. */
function OpportunityPicker({
  opportunities,
  selected,
}: {
  opportunities: Opportunity[];
  selected: string;
}) {
  return (
    <select name="sale" defaultValue={selected} className={input}>
      <option value="">Choose the opportunity that paid…</option>
      {opportunities.map((o) => (
        <option key={o.id} value={o.id}>
          {o.company} — {STAGE_LABEL[o.sale.stage]}
          {o.sale.paymentConfirmed ? ' · paid' : ' · unpaid'}
          {o.sale.term ? ` · ${o.sale.term}` : ''}
        </option>
      ))}
    </select>
  );
}

export default async function PlacementsPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  requireAdmin();
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : (v ?? ''));
  const query = one(searchParams?.q).slice(0, 60);
  const err = one(searchParams?.err);
  const ok = one(searchParams?.ok);

  // The review step. `listing` names the sale being prepared, `renew` names a
  // placement being re-sold; they are separate parameters so a renewal can never
  // be mistaken for a first activation, and vice versa.
  const activateId = uuidOrEmpty(one(searchParams?.listing));
  const renewId = uuidOrEmpty(one(searchParams?.renew));
  const targetId = renewId || activateId;
  const mode: 'activate' | 'renew' = renewId ? 'renew' : 'activate';
  const saleId = uuidOrEmpty(one(searchParams?.sale));
  const billingRaw = one(searchParams?.billing);
  const billing: FeaturedTerm | null =
    billingRaw === 'annual' ? 'annual' : billingRaw === 'monthly' ? 'monthly' : null;

  const schema = await adminFeaturedSchema();
  const now = new Date();
  const {
    ok: loaded,
    featured,
    sponsors,
    matches,
    opportunities,
    target,
  } = await load(query, targetId, schema);

  const chosenSale = opportunities.find((o) => o.id === saleId) ?? null;

  /**
   * The whole gate, computed before the button exists.
   *
   * `billing` defaults to monthly for the review so the term line shows a real
   * date on the first render rather than a blank the operator has to provoke.
   * The `billing` checklist line still reports whether the choice matches what
   * the opportunity was sold, so defaulting cannot hide a mismatch.
   */
  const checklist: ActivationChecklist | null = target
    ? featuredActivationChecklist({
        listing: target,
        sale: chosenSale?.sale ?? null,
        billing: billing ?? 'monthly',
        existing: featured,
        now,
        schema,
        mode,
      })
    : null;
  const renewal =
    mode === 'renew' && target
      ? renewalEffect(target.featuredUntil, billing ?? 'monthly', now)
      : null;

  /** Where each currently-flagged listing sits against its paid term. */
  const featuredStatus = new Map(
    featured.map((l) => [l.id, featuredWindowStatus(l, now, schema)] as const),
  );

  // Capacity per page, computed from the live featured set.
  const byCategory = new Map<string, number>();
  const byCorridor = new Map<string, number>();
  // Only placements still IN TERM occupy a slot. A row whose term has passed is
  // already off the public page, so counting it would show a page as full that a
  // driver sees as empty.
  for (const l of featured.filter((f) => f.isPublished && featuredStatus.get(f.id) === 'active')) {
    if (l.categorySlug) byCategory.set(l.categorySlug, (byCategory.get(l.categorySlug) ?? 0) + 1);
    if (l.interstate) byCorridor.set(l.interstate, (byCorridor.get(l.interstate) ?? 0) + 1);
  }
  const corridorSponsors = sponsors.filter((s) => s.placements.includes('interstate'));

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-2xl uppercase text-ink">Paid placements</h1>
      <p className="mt-2 text-sm text-muted">
        Featured listing {priceLabel(getOffer('featured-listing'))} · corridor sponsor{' '}
        {priceLabel(getOffer('corridor-sponsor'))}. Capacity: {PRIMARY_CORRIDOR_SPONSORS} primary
        sponsor per corridor page, up to {FEATURED_PER_PAGE} sponsored listings per category or
        corridor page. Every paid placement renders labelled{' '}
        <span className="font-semibold text-ink">Sponsored</span>.
      </p>
      <p className="mt-2 text-sm text-muted">
        <span className="font-semibold text-ink">This page takes no payment.</span> Activating is a
        record you make <em>after</em> payment has been confirmed outside the platform. Claims are
        free and are handled on{' '}
        <Link href="/admin/sponsors" className="text-signal underline">
          the sponsor inbox
        </Link>{' '}
        — never here.
      </p>

      {!loaded && (
        <p className="mt-4 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm text-diesel-300">
          Could not read placement data. Nothing can be activated until that is fixed.
        </p>
      )}
      {err && (
        <p className="mt-4 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm text-diesel-300">
          <span className="font-semibold">Refused.</span> {err}
        </p>
      )}
      {ok && (
        <p className="mt-4 rounded-card border border-signal bg-signal/10 px-4 py-3 text-sm text-ink">
          {ok}
        </p>
      )}

      {/* ------------------------------------------------ capacity overview */}
      <h2 className="mt-10 font-display text-lg uppercase text-ink">Capacity in use</h2>
      {byCategory.size === 0 && byCorridor.size === 0 && corridorSponsors.length === 0 ? (
        <p className="mt-2 text-sm text-muted">
          Nothing is sponsored anywhere yet. Every page has its full capacity free.
        </p>
      ) : (
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div className="rounded-card border border-line bg-asphalt-800 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Sponsored listings per page
            </p>
            <ul className="mt-2 space-y-1 text-sm text-muted">
              {[...byCategory.entries()].map(([slug, n]) => (
                <li key={`c-${slug}`}>
                  {slug}:{' '}
                  <span
                    className={
                      n >= FEATURED_PER_PAGE ? 'font-semibold text-diesel-300' : 'text-ink'
                    }
                  >
                    {n}/{FEATURED_PER_PAGE}
                  </span>
                </li>
              ))}
              {[...byCorridor.entries()].map(([corr, n]) => (
                <li key={`i-${corr}`}>
                  {corr}:{' '}
                  <span
                    className={
                      n >= FEATURED_PER_PAGE ? 'font-semibold text-diesel-300' : 'text-ink'
                    }
                  >
                    {n}/{FEATURED_PER_PAGE}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-card border border-line bg-asphalt-800 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Primary corridor sponsors
            </p>
            <ul className="mt-2 space-y-1 text-sm text-muted">
              {corridorSponsors.length === 0 && <li>None.</li>}
              {corridorSponsors.map((s) => (
                <li key={s.id}>
                  {s.interstates.length ? s.interstates.join(', ') : 'EVERY CORRIDOR'} — {s.name}{' '}
                  <span className="text-xs">({windowStatus(s)})</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* ------------------------------------------------- active featured */}
      <h2 className="mt-10 font-display text-lg uppercase text-ink">
        Sponsored listings ({featured.length})
      </h2>
      {schema === 'ready' ? (
        <p className="mt-1 text-xs text-muted">
          A featured listing carries its own end date and stops showing the moment the term passes —
          no action needed, exactly like a corridor sponsor. A row left flagged after that is
          housekeeping, not a live placement: it is already off every public page.
        </p>
      ) : (
        <p className="mt-3 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm text-diesel-300">
          <span className="font-semibold">Featured-expiry schema is not active yet.</span> Migration
          057 has not been applied, so <code>featured_until</code> cannot be read or written. Until
          it is: any featured listing runs until it is stopped by hand here, the term ending changes
          nothing on the public site by itself, and activating a NEW featured listing is blocked —
          switching one on without a term is the defect this migration removes. Corridor sponsorship
          is unaffected and can be sold and activated normally.
        </p>
      )}
      {featured.length === 0 ? (
        <p className="mt-3 text-sm text-muted">None.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {featured.map((l) => {
            // The CRM opportunity that paid for this placement, found through the
            // audit line the activation wrote. `locations` has no column pointing
            // at the CRM, so this is how the term length is known after the fact
            // — and when nothing matches, the console says so rather than
            // inventing a term.
            const paidBy = matchFeaturedOpportunity(l.name, opportunities);
            const view = placementLiveView(l, paidBy?.term ?? null, now, schema);
            const opportunity = paidBy ? opportunities.find((o) => o.id === paidBy.id) : undefined;
            return (
              <li key={l.id} className="rounded-card border border-line bg-asphalt-800 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-display text-base uppercase text-ink">{l.name}</p>
                  {/* The state in a word, not a colour and not a status code. */}
                  <p
                    className={`text-xs font-bold uppercase tracking-widest ${
                      view.headline === 'ACTIVATED' ? 'text-signal' : 'text-diesel-300'
                    }`}
                  >
                    {view.headline}
                  </p>
                </div>
                <p className="text-xs text-muted">
                  {[l.categorySlug, l.city, l.state, l.interstate].filter(Boolean).join(' · ')}
                  {!l.isPublished && ' · NOT PUBLISHED'}
                </p>

                <dl className="mt-3 grid gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
                  <div>
                    <dt className="inline text-muted">Ends </dt>
                    <dd className="inline font-semibold text-ink">
                      {view.expiryDay ?? 'no end date recorded'}
                      {view.daysRemaining !== null &&
                        (view.daysRemaining > 0
                          ? ` · ${view.daysRemaining} ${view.daysRemaining === 1 ? 'day' : 'days'} left`
                          : ` · ended ${-view.daysRemaining} ${view.daysRemaining === -1 ? 'day' : 'days'} ago`)}
                    </dd>
                  </div>
                  <div>
                    <dt className="inline text-muted">Term </dt>
                    <dd className="inline text-ink">{view.termLabel}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="inline text-muted">Paid by </dt>
                    <dd className="inline text-ink">
                      {opportunity
                        ? opportunity.company
                        : 'no CRM opportunity records activating this listing'}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="inline text-muted">Public right now: </dt>
                    <dd className="inline text-ink">{view.publicState}</dd>
                  </div>
                </dl>

                <div className="mt-3 flex flex-wrap items-end gap-3">
                  {/* Renewal goes through the SAME review step activation does,
                      because a renewal is a second sale. The link carries the
                      listing; the checklist on the other side asks for the
                      opportunity and shows what the new term will be. */}
                  {view.canRenew && (
                    <Link
                      href={`/admin/directory/placements?renew=${l.id}${
                        paidBy ? `&sale=${paidBy.id}` : ''
                      }#review`}
                      className={`${btnGhost} inline-flex items-center`}
                    >
                      Renew this placement
                    </Link>
                  )}
                  {view.canStop && (
                    <form
                      action={deactivateFeaturedAction}
                      className="flex flex-wrap items-end gap-2"
                    >
                      <input type="hidden" name="listing_id" value={l.id} />
                      {paidBy && <input type="hidden" name="sponsor_id" value={paidBy.id} />}
                      <label className={label}>
                        Reviewer
                        <input name="reviewer" className={`${input} w-32`} placeholder="Shawn" />
                      </label>
                      <button className={btnGhost}>Stop sponsorship</button>
                    </form>
                  )}
                </div>
                <p className="mt-2 text-xs text-muted">
                  Stopping removes the Sponsored label and the end date. It never unpublishes the
                  business, never deletes it, and never touches what you were paid — that history
                  stays on the CRM opportunity.
                </p>
              </li>
            );
          })}
        </ul>
      )}

      {/* ------------------------------------------- activate a featured listing */}
      <h2 id="review" className="mt-10 font-display text-lg uppercase text-ink">
        {mode === 'renew' ? 'Renew a featured listing' : 'Sell a featured listing'}
      </h2>

      {/* ---------------------------------------------------- step 1: find it */}
      {mode === 'activate' && (
        <>
          <p className="mt-1 text-xs text-muted">
            Step 1 — find the business. Step 2 — pick the opportunity that paid. Step 3 — read the
            checklist and activate. Nothing is written until step 3.
          </p>
          <form method="get" className="mt-3 flex gap-2">
            <input
              name="q"
              defaultValue={query}
              placeholder="Search a published listing by name…"
              className={input}
            />
            <button className={btnGhost}>Search</button>
          </form>

          {query && matches.length === 0 && (
            <p className="mt-3 text-sm text-muted">No published listing matches “{query}”.</p>
          )}

          {matches.map((l) => (
            <div
              key={l.id}
              className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-asphalt-800 p-4"
            >
              <div className="min-w-0">
                <p className="font-display text-base uppercase text-ink">{l.name}</p>
                <p className="text-xs text-muted">
                  {[l.categorySlug, l.city, l.state, l.interstate].filter(Boolean).join(' · ')}
                  {l.isFeatured && ' · already sponsored'}
                </p>
              </div>
              {/* A GET, so choosing a listing writes nothing and can be undone
                  with the back button. The review step below is the only thing
                  that renders an ACTIVATE control. */}
              <form method="get" className="flex items-end gap-2">
                <input type="hidden" name="q" value={query} />
                <input type="hidden" name="listing" value={l.id} />
                <button className={btnGhost}>Prepare this sale</button>
              </form>
            </div>
          ))}
        </>
      )}

      {/* ------------------------------------ steps 2 and 3: the review step */}
      {targetId !== '' && !target && (
        <p className="mt-4 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm text-diesel-300">
          That listing could not be read, so nothing can be checked or activated.
        </p>
      )}

      {target && checklist && (
        <div className="mt-4 rounded-card border border-line bg-asphalt-800 p-4 sm:p-5">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
            {mode === 'renew' ? 'Renewal checklist' : 'Activation checklist'}
          </p>
          <p className="mt-1 font-display text-lg uppercase text-ink">{target.name}</p>

          {/* Step 2 — the opportunity and the term, chosen here rather than
              carried across from another console as a pasted id. */}
          <form method="get" className="mt-4 grid gap-3 sm:grid-cols-3">
            <input type="hidden" name="q" value={query} />
            <input type="hidden" name={mode === 'renew' ? 'renew' : 'listing'} value={target.id} />
            <label className={`${label} sm:col-span-2`}>
              Which opportunity paid for this?
              {opportunities.length === 0 ? (
                <span className="mt-1 block rounded-card border border-diesel bg-diesel/10 px-3 py-2 text-xs text-diesel-300">
                  No featured-listing opportunity exists yet. Create one, record the quote and
                  record the payment on{' '}
                  <Link href="/admin/directory/revenue" className="text-signal underline">
                    the revenue console
                  </Link>{' '}
                  first — a placement never goes live unsold.
                </span>
              ) : (
                <OpportunityPicker opportunities={opportunities} selected={saleId} />
              )}
            </label>
            <label className={label}>
              Billing period
              <select name="billing" defaultValue={billing ?? 'monthly'} className={input}>
                <option value="monthly">Monthly — {priceLabel(OFFERS[1]).split(' or ')[0]}</option>
                <option value="annual">Annual — {priceLabel(OFFERS[1]).split(' or ')[1]}</option>
              </select>
            </label>
            <div className="sm:col-span-3">
              <button className={btnGhost}>Re-check</button>
            </div>
          </form>

          {/* Named here as well as in the checklist line, because the fix is
              an operational one the owner has to go and do: the line says what
              is wrong, this says which migration puts it right. */}
          {schema !== 'ready' && (
            <p className="mt-3 rounded-card border border-diesel bg-diesel/10 px-3 py-2 text-xs text-diesel-300">
              Activation is blocked until migration 057 is applied. Switching a listing on now would
              give it no expiry, which is exactly what that migration removes.
            </p>
          )}

          {/* The gates, all of them, before anything is written. */}
          <ul className="mt-4">
            {checklist.gates.map((g) => (
              <GateLine key={g.id} gate={g} />
            ))}
          </ul>

          {renewal && (
            <p
              className={`mt-3 rounded-card border px-3 py-2 text-xs ${
                renewal.losesTime
                  ? 'border-signal bg-signal/10 text-ink'
                  : 'border-line bg-asphalt text-muted'
              }`}
            >
              <span className="font-semibold uppercase tracking-wide">
                What renewing now does:{' '}
              </span>
              {renewal.note}
            </p>
          )}

          {checklist.canActivate ? (
            <form
              action={mode === 'renew' ? renewFeaturedAction : activateFeaturedAction}
              className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-3"
            >
              <input type="hidden" name="listing_id" value={target.id} />
              <input type="hidden" name="sponsor_id" value={saleId} />
              <input type="hidden" name="billing" value={billing ?? 'monthly'} />
              <div className="rounded-card border border-dashed border-line bg-asphalt p-3 sm:col-span-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
                  What pressing this writes
                </p>
                <p className="mt-2 text-sm text-ink">
                  {target.name} becomes Sponsored now and stops on{' '}
                  <span className="font-semibold">{checklist.expiryDay}</span>. One write sets both
                  the label and the end date together — there is no moment where it is sponsored
                  with no expiry.
                </p>
                <p className="mt-1 text-xs text-muted">
                  Its hours, services, parking and reviews are unchanged. Payment never edits a
                  listing.
                </p>
              </div>
              <label className={label}>
                Reviewer
                <input name="reviewer" placeholder="Shawn" required className={input} />
              </label>
              <label className={label}>
                Type ACTIVATE to confirm
                <input name="confirm" autoComplete="off" className={input} />
              </label>
              <div className="flex items-end">
                <button className={btn}>
                  {mode === 'renew' ? 'Renew featured listing' : 'Activate featured listing'}
                </button>
              </div>
              <p className="text-xs text-muted sm:col-span-3">
                Every line above is checked again against live data at the moment you press this, so
                a change made in another tab in the meantime is refused rather than written.
              </p>
            </form>
          ) : (
            <p className="mt-4 rounded-card border border-diesel bg-diesel/10 px-3 py-3 text-sm text-diesel-300">
              <span className="font-semibold">
                {mode === 'renew' ? 'This renewal' : 'This sale'} cannot be activated yet.
              </span>{' '}
              Clear the {checklist.blockers.length === 1 ? 'line' : 'lines'} marked NO above. No
              control is offered until every line passes — there is nothing here to press by
              mistake.
            </p>
          )}
        </div>
      )}

      {/* ------------------------------------------- corridor sponsors */}
      <h2 className="mt-12 font-display text-lg uppercase text-ink">
        Corridor sponsors ({corridorSponsors.length})
      </h2>
      <p className="mt-1 text-xs text-muted">
        A corridor sponsor stops showing on its own the moment its end date passes — no action
        needed. Stopping one early is still instant.
      </p>
      {corridorSponsors.length === 0 ? (
        <p className="mt-3 text-sm text-muted">None.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {corridorSponsors.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-asphalt-800 p-4"
            >
              <div>
                <p className="font-display text-base uppercase text-ink">
                  {s.name}{' '}
                  <span className="text-xs text-muted">
                    ({s.active ? windowStatus(s) : 'stopped'})
                  </span>
                </p>
                <p className="text-xs text-muted">
                  {s.interstates.length ? s.interstates.join(', ') : 'EVERY CORRIDOR — check this'}{' '}
                  · {fmt(s.startsAt)} → {fmt(s.endsAt)}
                </p>
                <p className="mt-1 break-all text-xs text-muted">{s.url}</p>
              </div>
              <form action={setCorridorSponsorActiveAction}>
                <input type="hidden" name="id" value={s.id} />
                <input type="hidden" name="active" value={String(!s.active)} />
                <button className={btnGhost}>{s.active ? 'Stop' : 'Restart'}</button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form
        action={activateCorridorSponsorAction}
        className="mt-6 grid gap-3 rounded-card border border-line bg-asphalt-800 p-5 sm:grid-cols-3"
      >
        <h3 className="font-display text-base uppercase text-ink sm:col-span-3">
          Activate a corridor sponsor
        </h3>
        <label className={label}>
          Business name
          <input name="name" required className={input} />
        </label>
        <label className={label}>
          Corridor (I-95)
          <input name="corridor" required placeholder="I-95" className={input} />
        </label>
        <label className={label}>
          Link (https://…)
          <input name="url" type="url" required className={input} />
        </label>
        <label className={label}>
          Tagline (optional)
          <input name="tagline" className={input} />
        </label>
        <label className={label}>
          Logo emoji (optional)
          <input name="logo" maxLength={4} className={input} />
        </label>
        <label className={label}>
          Billing
          <select name="billing" defaultValue="monthly" className={input}>
            <option value="monthly">Monthly — {priceLabel(OFFERS[2]).split(' or ')[0]}</option>
            <option value="annual">Annual — {priceLabel(OFFERS[2]).split(' or ')[1]}</option>
          </select>
        </label>
        <label className={label}>
          Starts
          <input type="date" name="starts_on" defaultValue={today()} required className={input} />
        </label>
        <label className={label}>
          Ends (required)
          <input type="date" name="ends_on" required className={input} />
        </label>
        <label className={label}>
          Reviewer
          <input name="reviewer" placeholder="Shawn" required className={input} />
        </label>
        <label className={label}>
          CRM row id (required)
          <input name="sponsor_id" required className={input} />
        </label>
        <label className={label}>
          Type ACTIVATE to confirm
          <input name="confirm" autoComplete="off" className={input} />
        </label>
        <div className="rounded-card border border-dashed border-line bg-asphalt p-3 sm:col-span-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted">
            Preview — what the public sees
          </p>
          <p className="mt-2 text-xs text-muted">
            A block headed <span className="font-semibold text-ink">Sponsored</span>, set apart from
            the listings, carrying the business name, its tagline, and one outbound link with
            rel=&quot;sponsored noopener noreferrer&quot;. It is never ranked among listings and
            never styled as one, and it disappears on its own once the end date passes.
          </p>
        </div>
        <p className="text-xs text-muted sm:col-span-3">
          Leaving the corridor blank is refused — a blank corridor would target every corridor page
          in the country, not none. Activation is also refused unless the CRM opportunity is
          committed or closed-won, has the corridor-sponsor offer and an agreed term recorded, and
          has a confirmed payment covering the agreed amount (
          <Link href="/admin/directory/revenue" className="text-signal underline">
            the revenue console
          </Link>
          ).
        </p>
        <div className="sm:col-span-3">
          <button className={btn}>Activate corridor sponsor</button>
        </div>
      </form>

      <p className="mt-8 text-xs text-muted">
        Capacity is checked against live data at the moment you activate. It is an application
        check, not a database constraint — two administrators activating the same page in the same
        second could still overrun it. Making it a hard invariant needs a migration, which this work
        deliberately did not add. General (non-corridor) sponsor placements live on{' '}
        <Link href="/admin/directory/sponsors" className="text-signal underline">
          the sponsor placement manager
        </Link>
        .
      </p>
    </div>
  );
}
