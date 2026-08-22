import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  BILLING_LABEL,
  OFFERS,
  formatPrice,
  paidOffers,
  priceLabel,
  standardAmountCents,
} from '@/lib/directory/offers';
import {
  STAGE_LABEL,
  STAGE_TRANSITIONS,
  findDuplicates,
  isoDay,
  normaliseCompany,
  pipelineSummary,
  rate,
  readSaleState,
  type SponsorSaleRow,
} from '@/lib/directory/revenue';
import { FEATURED_PER_PAGE, PRIMARY_CORRIDOR_SPONSORS } from '@/lib/directory/placements';
import { adminFeaturedSchema } from '@/lib/admin/featured-schema';
import type { FeaturedSchema } from '@/lib/directory/featured-window';
import {
  MONETIZABLE_CATEGORIES,
  outreachQueueLines,
  shortlist,
  type ProspectListing,
} from '@/lib/directory/prospects';
import {
  BUCKET_LABEL,
  MONEY_BUCKETS,
  NEXT_ACTION_LABEL,
  RENEWAL_STANDING_LABEL,
  activationHandoffHref,
  corridorPlacementState,
  featuredPlacementState,
  matchesFilter,
  moneyQueue,
  opportunityView,
  pipelineBuckets,
  renewalQueue,
  type OpportunityView,
  type PlacementState,
  type QueueFilter,
} from '@/lib/directory/money-queue';
import { matchFeaturedOpportunity } from '@/lib/directory/first-sale';
import {
  addTouchAction,
  createOpportunityAction,
  recordPaymentAction,
  recordQualificationAction,
  recordQuoteAction,
  setNextActionAction,
  setRenewalAction,
  setStageAction,
} from './actions';

/**
 * The revenue console — one screen for taking a directory inquiry from
 * "arrived" to "paid", and for noticing when a live placement's term runs out.
 *
 * It is deliberately NOT an activation screen. Turning a placement on writes to
 * `locations` or `directory_sponsors` and stays on the placements console; this
 * page decides whether a deal has cleared the sale side of that gate and links
 * across when it has. The separation is the gated progression: no single
 * control anywhere takes a new inquiry to a live public placement.
 *
 * Everything shown is derived at read time from columns that already exist —
 * `stage`, `status`, `pledged_cents`, `paid_cents`, `next_action_date`,
 * `tier_interest` — plus the labelled note lines the actions append. No
 * migration, and no second source of truth for a price: every figure comes from
 * the offer authority.
 *
 * Empty states are honest. With no inquiries there is no conversion rate to
 * show, so it says there is no data rather than rendering a 0% that reads like
 * a result.
 */

export const dynamic = 'force-dynamic';
export const metadata = {
  title: 'Admin — Directory Revenue',
  robots: { index: false, follow: false },
  // Child `alternates` replaces the parent's wholesale, which is what stops the
  // root layout's homepage canonical inheriting onto an admin URL.
  alternates: { canonical: null },
};

const ROW_COLS =
  'id, company, contact_name, email, phone, stage, status, tier_interest, pledged_cents, paid_cents, priority, next_action, next_action_date, notes, created_at';

type RawRow = {
  id: string;
  company: string | null;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  stage: string | null;
  status: string | null;
  tier_interest: string | null;
  pledged_cents: number | null;
  paid_cents: number | null;
  priority: number | null;
  next_action: string | null;
  next_action_date: string | null;
  notes: string | null;
  created_at: string;
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

const PROSPECT_COLS =
  'id, name, detail_slug, category_slug, state, city, interstate, phone, website, is_published, is_featured, deleted_at';

function toProspectListing(r: Record<string, unknown>): ProspectListing {
  return {
    id: String(r.id),
    name: (r.name as string) ?? null,
    detailSlug: (r.detail_slug as string) ?? null,
    categorySlug: (r.category_slug as string) ?? null,
    state: (r.state as string) ?? null,
    city: (r.city as string) ?? null,
    interstate: (r.interstate as string) ?? null,
    phone: (r.phone as string) ?? null,
    website: (r.website as string) ?? null,
    isPublished: Boolean(r.is_published),
    isFeatured: Boolean(r.is_featured),
    deletedAt: (r.deleted_at as string) ?? null,
  };
}

/**
 * The `locations` columns the featured authority needs, and nothing else. No
 * commercial field is read here and none could be: this projection is the whole
 * of what the revenue console learns about a listing.
 */
const FEATURED_COLS_BASE = 'id, name, is_featured, is_published, deleted_at';
const CORRIDOR_COLS = 'id, name, active, starts_at, ends_at';

type LoadResult = {
  ok: boolean;
  rows: RawRow[];
  listings: ProspectListing[];
  featured: FeaturedRow[];
  corridor: CorridorRow[];
};

type FeaturedRow = {
  id: string;
  name: string | null;
  isFeatured: boolean;
  isPublished: boolean;
  deletedAt: string | null;
  featuredUntil?: string | null;
};

type CorridorRow = {
  id: string;
  name: string;
  active: boolean;
  startsAt: string | null;
  endsAt: string | null;
};

async function load(featuredSchema: FeaturedSchema): Promise<LoadResult> {
  try {
    const supabase = createAdminClient();
    const [crm, candidates, featuredRows, corridorRows] = await Promise.all([
      supabase
        .from('sponsors')
        .select(ROW_COLS)
        .order('created_at', { ascending: false })
        .limit(500),
      // Bounded at the query, not in memory: only published, non-deleted,
      // non-sponsored listings in a category that has somebody to sell to.
      supabase
        .from('locations')
        .select(PROSPECT_COLS)
        .eq('is_published', true)
        .eq('is_featured', false)
        .is('deleted_at', null)
        .in('category_slug', [...MONETIZABLE_CATEGORIES])
        .not('interstate', 'is', null)
        .order('name')
        .limit(400),
      // THE PLACEMENT AUTHORITIES. Liveness is not read from `sponsors.status`:
      // that column is a mirror written at activation, and stopping a featured
      // listing never clears it, so a stopped placement keeps reading `active`
      // with its old renewal date. These two reads are what "live" means.
      supabase
        .from('locations')
        .select(
          featuredSchema === 'ready' ? `${FEATURED_COLS_BASE}, featured_until` : FEATURED_COLS_BASE,
        )
        .eq('is_featured', true)
        .is('deleted_at', null)
        .limit(200),
      supabase.from('directory_sponsors').select(CORRIDOR_COLS).limit(200),
    ]);
    if (crm.error) return EMPTY;
    return {
      ok: true,
      rows: (crm.data as unknown as RawRow[]) ?? [],
      listings: ((candidates.data as Record<string, unknown>[]) ?? []).map(toProspectListing),
      featured: ((featuredRows.data as unknown as Record<string, unknown>[] | null) ?? []).map(
        (r) => ({
          id: String(r.id),
          name: (r.name as string) ?? null,
          isFeatured: Boolean(r.is_featured),
          isPublished: Boolean(r.is_published),
          deletedAt: (r.deleted_at as string) ?? null,
          featuredUntil: (r.featured_until as string | null | undefined) ?? undefined,
        }),
      ),
      corridor: ((corridorRows.data as unknown as Record<string, unknown>[] | null) ?? []).map(
        (r) => ({
          id: String(r.id),
          name: String(r.name ?? ''),
          active: Boolean(r.active),
          startsAt: (r.starts_at as string) ?? null,
          endsAt: (r.ends_at as string) ?? null,
        }),
      ),
    };
  } catch {
    return EMPTY;
  }
}

const EMPTY: LoadResult = { ok: false, rows: [], listings: [], featured: [], corridor: [] };

// 44px minimum on every actionable control. `px-3 py-2 text-sm` lands at 37-38px,
// which is under the touch target this admin is worked from — the owner uses it
// on a phone between calls, not only at a desk.
const input =
  'min-h-[44px] w-full rounded-card border border-line bg-asphalt px-3 py-2 text-sm text-ink';
const label = 'block text-xs text-muted';
const btn =
  'min-h-[44px] rounded-card bg-signal px-4 py-2 font-display text-sm uppercase tracking-wide text-asphalt hover:bg-signal-600';
const btnGhost =
  'min-h-[44px] rounded-card border border-line px-3 py-2 text-xs text-ink hover:border-signal';

const fmtDay = (d: string | null) => d ?? '—';

/** A count tile. `null` means "no data", never rendered as a zero result. */
function Tile({ label: text, value, tone }: { label: string; value: string; tone?: 'warn' }) {
  return (
    <div className="rounded-card border border-line bg-asphalt-800 p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">{text}</p>
      <p
        className={`mt-1 font-display text-2xl ${tone === 'warn' ? 'text-diesel-300' : 'text-ink'}`}
      >
        {value}
      </p>
    </div>
  );
}

/**
 * One opportunity, answering the five questions an owner should not have to
 * open another screen for: who, what are we selling, how much, where are we,
 * and what do I do next.
 *
 * State is carried by a WORD in every case. A row that is overdue says
 * "Overdue"; it is not merely tinted red, because the owner reads this on a
 * phone in daylight and because colour alone is not an accessible signal.
 */
function OpportunityCard({
  view,
  openHref,
  showBucket,
}: {
  view: OpportunityView;
  openHref: string;
  showBucket?: boolean;
}) {
  const handoff = activationHandoffHref(view);
  const urgent =
    view.nextActionState === 'overdue' ||
    view.bucket === 'ready-to-activate' ||
    view.bucket === 'awaiting-payment';
  return (
    <li
      className={`rounded-card border bg-asphalt-800 p-4 ${
        urgent ? 'border-signal' : 'border-line'
      }`}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        {/* 1 · who */}
        <p className="break-words font-display text-base uppercase text-ink">{view.company}</p>
        {/* 4 · where are we */}
        <p className="text-xs font-bold uppercase tracking-widest text-signal">
          {showBucket ? BUCKET_LABEL[view.bucket] : view.saleStepLabel}
        </p>
      </div>

      {/* 2 · what are we selling · 3 · how much */}
      <p className="mt-1 break-words text-xs text-muted">
        {view.product}
        {view.term ? ` · ${BILLING_LABEL[view.term]}` : ''} ·{' '}
        <span className="text-ink">{view.amountLabel}</span>
        {view.amountCents !== null && !view.amountIsAgreed && ' (list price — nothing agreed yet)'}
      </p>

      {/* 5 · what do I do next */}
      <p className="mt-2 break-words text-sm">
        <span
          className={`mr-2 text-[10px] font-bold uppercase tracking-widest ${
            view.nextActionState === 'overdue' || view.nextActionState === 'none'
              ? 'text-diesel-300'
              : 'text-muted'
          }`}
        >
          {NEXT_ACTION_LABEL[view.nextActionState]}
        </span>
        <span className="text-ink">
          {view.nextAction ?? 'Decide what happens next and put a date on it.'}
        </span>
        {view.nextActionDate && view.nextActionState !== 'none' && (
          <span className="text-muted">
            {' '}
            · {view.nextActionDate}
            {view.daysOverdue !== null &&
              ` · ${view.daysOverdue} ${view.daysOverdue === 1 ? 'day' : 'days'} late`}
          </span>
        )}
      </p>

      {view.placement.kind !== 'none' && (
        <p className="mt-1 text-xs text-muted">
          {view.placement.live ? 'Live' : 'Not showing'}
          {view.placement.endsAt ? ` · ends ${view.placement.endsAt.slice(0, 10)}` : ''}
          {view.placement.daysRemaining !== null &&
            ` · ${
              view.placement.daysRemaining > 0
                ? `${view.placement.daysRemaining} ${view.placement.daysRemaining === 1 ? 'day' : 'days'} left`
                : `ended ${-view.placement.daysRemaining} ${view.placement.daysRemaining === -1 ? 'day' : 'days'} ago`
            }`}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <Link href={openHref} className={`${btnGhost} inline-flex items-center`}>
          Open
        </Link>
        {/* THE HANDOFF. A link and nothing more — it writes nothing, and every
            gate still runs on the placements console where ACTIVATE is typed. */}
        {view.bucket === 'ready-to-activate' && handoff && (
          <Link href={handoff} className={`${btn} inline-flex items-center`}>
            Activate this placement
          </Link>
        )}
      </div>
    </li>
  );
}

export default async function RevenuePage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  requireAdmin();
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : (v ?? ''));
  const err = one(searchParams?.err);
  const ok = one(searchParams?.ok);
  const openId = one(searchParams?.open);

  const featuredSchema = await adminFeaturedSchema();
  const { ok: loaded, rows, listings, featured, corridor } = await load(featuredSchema);
  const now = new Date();
  const today = isoDay(now);
  const saleRows = rows.map(toSaleRow);
  const summary = pipelineSummary(saleRows, now, featuredSchema);

  const contacted = summary.total - summary.byStage.prospect;
  const contactRate = rate(contacted, summary.total);
  const warmRate = rate(
    summary.byStage.warm + summary.byStage.committed + summary.byStage.closed_won,
    summary.total,
  );
  const paidRate = rate(summary.paid + summary.active, summary.total);

  // Liveness, the renewal view and the parsed inquiry all moved to the money
  // queue, which reads the placement authority rather than the CRM mirror. What
  // is still needed per row is the sale state and the duplicate warning.
  const enriched = rows.map((r) => {
    const sale = readSaleState(toSaleRow(r));
    const duplicates = findDuplicates(
      { id: r.id, company: r.company, email: r.email, phone: r.phone },
      rows.map((o) => ({ id: o.id, company: o.company, email: o.email, phone: o.phone })),
    );
    return { row: r, sale, duplicates };
  });

  /* ------------------------------------------------- the placement authority

     Which opportunity paid for which live placement. `locations` has no column
     pointing at the CRM, so a featured listing is matched through the audit line
     REVENUE-3 writes into `sponsors.notes` at activation — reading the trail as
     it was designed to be read. A corridor sponsor is matched on the business
     name, which is what `directory_sponsors` stores.

     Unmatched either way is a real state, not a failure: a placement flagged by
     an import, or one whose audit note never landed. Those simply have no
     opportunity attached and the console says so rather than guessing. */
  const noteRows = rows.map((r) => ({ id: r.id, notes: r.notes }));
  const placementBySponsor = new Map<string, PlacementState>();
  for (const listing of featured) {
    const match = matchFeaturedOpportunity(listing.name, noteRows);
    if (match && !placementBySponsor.has(match.id))
      placementBySponsor.set(match.id, featuredPlacementState(listing, now, featuredSchema));
  }
  for (const sponsor of corridor) {
    const key = normaliseCompany(sponsor.name);
    if (!key) continue;
    const owner = rows.find((r) => normaliseCompany(r.company) === key);
    if (owner && !placementBySponsor.has(owner.id))
      placementBySponsor.set(owner.id, corridorPlacementState(sponsor, now));
  }

  const views: OpportunityView[] = enriched.map((e) =>
    opportunityView(
      {
        id: e.row.id,
        company: e.row.company,
        sale: e.sale,
        nextAction: e.row.next_action,
        nextActionDate: e.row.next_action_date,
        placement: placementBySponsor.get(e.row.id) ?? { kind: 'none' },
        createdAt: e.row.created_at,
      },
      now,
    ),
  );
  const queue = moneyQueue(views);
  const buckets = pipelineBuckets(views);
  const renewals = renewalQueue(views, now);

  const filter: QueueFilter = {
    q: one(searchParams?.q).slice(0, 60),
    bucket: (one(searchParams?.bucket) || '') as QueueFilter['bucket'],
    offerId: (one(searchParams?.offer) || '') as QueueFilter['offerId'],
    nextAction: (one(searchParams?.na) || '') as QueueFilter['nextAction'],
  };
  const filtered = views
    .filter((v) => matchesFilter(v, filter))
    .sort((a, b) => a.rank - b.rank || a.company.localeCompare(b.company));

  const open = enriched.find((e) => e.row.id === openId) ?? null;

  const prospectQueue = shortlist(
    listings,
    rows.map((r) => ({ id: r.id, company: r.company })),
    25,
  );

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-2xl uppercase text-ink">Directory revenue</h1>
      <p className="mt-2 text-sm text-muted">
        {OFFERS.map((o) => `${o.name} ${priceLabel(o)}`).join(' · ')}. Capacity:{' '}
        {PRIMARY_CORRIDOR_SPONSORS} primary sponsor per corridor page, up to {FEATURED_PER_PAGE}{' '}
        sponsored listings per category or corridor page.
      </p>
      <p className="mt-2 text-sm text-muted">
        <span className="font-semibold text-ink">
          This console takes no payment and contacts nobody.
        </span>{' '}
        It records what has already happened. Turning a placement on is a separate, deliberate step
        on{' '}
        <Link href="/admin/directory/placements" className="text-signal underline">
          the placements console
        </Link>
        , and it refuses any deal that has not cleared the checks below.
      </p>

      {featuredSchema !== 'ready' && (
        <p className="mt-4 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm text-diesel-300">
          <span className="font-semibold">Featured-expiry schema is not active yet.</span> Migration
          057 has not been applied, so a featured listing still has no end date of its own: its term
          ending changes nothing on the public site until someone stops it by hand, and this console
          keeps warning you about that. New featured activations are blocked until it is applied.
          Corridor sponsorship already enforces its own window and is unaffected — it remains the
          safer first sale.
        </p>
      )}

      {!loaded && (
        <p className="mt-4 rounded-card border border-diesel bg-diesel/10 px-4 py-3 text-sm text-diesel-300">
          Could not read the sponsor pipeline. Nothing can be recorded until that is fixed.
        </p>
      )}
      <div aria-live="polite">
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
      </div>

      {/* --------------------------------------------------- today's money */}
      <h2 className="mt-10 font-display text-lg uppercase text-ink">
        Today&rsquo;s money ({queue.length})
      </h2>
      {summary.total === 0 ? (
        <div className="mt-3 rounded-card border border-signal bg-asphalt-800 p-4 sm:p-5">
          <p className="font-display text-base uppercase text-ink">Nothing in the pipeline yet</p>
          <p className="mt-2 text-sm text-muted">
            This is not an error — no business has inquired and none has been opened by hand. There
            are two ways to start, and neither of them is waiting.
          </p>
          <ol className="mt-3 space-y-2 text-sm text-muted">
            <li>
              <span className="font-semibold text-ink">1 · Pick someone to call.</span> The
              shortlist at the bottom of this page ranks {MONETIZABLE_CATEGORIES.length} monetizable
              categories by how complete their listing already is — built only from public directory
              data, and it contacts nobody.
            </li>
            <li>
              <span className="font-semibold text-ink">2 · Open the opportunity here.</span> Use the
              form below the moment the call ends, while you still remember what they said. Every
              step after that — quote, payment, activation — starts from the row you create.
            </li>
          </ol>
          <p className="mt-3 text-xs text-muted">
            An inbound inquiry through{' '}
            <Link href="/sponsors" className="text-signal underline">
              /sponsors
            </Link>{' '}
            lands here on its own, with its first follow-up already scheduled.
          </p>
        </div>
      ) : queue.length === 0 ? (
        <p className="mt-3 rounded-card border border-line bg-asphalt-800 p-4 text-sm text-muted">
          Nothing needs you today. Every open opportunity is scheduled for a later date, already
          live, or closed. The full list is below.
        </p>
      ) : (
        <>
          <p className="mt-1 text-xs text-muted">
            Worked top to bottom. A business that has already paid comes first — the only thing
            between that money and a live placement is you — then people who said yes, then
            follow-ups you owe.
          </p>
          <ul className="mt-3 space-y-3">
            {queue.map((v) => (
              <OpportunityCard key={v.id} view={v} openHref={`?open=${v.id}`} />
            ))}
          </ul>
        </>
      )}

      {/* ------------------------------------------------------- summary */}
      <h2 className="mt-10 font-display text-lg uppercase text-ink">Pipeline</h2>
      {summary.total === 0 ? (
        <p className="mt-2 rounded-card border border-line bg-asphalt-800 p-4 text-sm text-muted">
          Nothing to summarise yet. A conversion rate over zero inquiries would be an invented
          number rather than a result, so none is shown.
        </p>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            <Tile label="New leads" value={String(buckets.newLeads)} />
            <Tile
              label="Follow up today"
              value={String(buckets.followUpToday)}
              tone={buckets.followUpToday > 0 ? 'warn' : undefined}
            />
            <Tile
              label="Overdue follow-up"
              value={String(buckets.followUpOverdue)}
              tone={buckets.followUpOverdue > 0 ? 'warn' : undefined}
            />
            <Tile label="Quoted" value={String(buckets.quoted)} />
            <Tile
              label="Said yes — not paid"
              value={String(buckets.awaitingPayment)}
              tone={buckets.awaitingPayment > 0 ? 'warn' : undefined}
            />
            <Tile
              label="Paid — activate now"
              value={String(buckets.readyToActivate)}
              tone={buckets.readyToActivate > 0 ? 'warn' : undefined}
            />
            <Tile label="Live" value={String(buckets.live)} />
            <Tile
              label="Renewals due"
              value={String(buckets.renewalsDue)}
              tone={buckets.renewalsDue > 0 ? 'warn' : undefined}
            />
            <Tile
              label="No next step set"
              value={String(buckets.missingNextAction)}
              tone={buckets.missingNextAction > 0 ? 'warn' : undefined}
            />
            <Tile label="Open pipeline" value={formatPrice(summary.openPipelineCents)} />
            <Tile label="Collected" value={formatPrice(summary.collectedCents)} />
          </div>
          <p className="mt-3 text-xs text-muted">
            Contacted {contactRate === null ? 'no data' : `${contactRate}%`} · warm or better{' '}
            {warmRate === null ? 'no data' : `${warmRate}%`} · paid{' '}
            {paidRate === null ? 'no data' : `${paidRate}%`}. Every count above is a count of the
            same opportunities listed on this page — a tile and the list under it cannot disagree.
            Live and renewal figures come from the placement itself, not from the CRM&rsquo;s copy
            of it.
          </p>
        </>
      )}

      {/* ------------------------------------------------------- renewals */}
      <h2 className="mt-10 font-display text-lg uppercase text-ink">
        Renewals and expiry ({renewals.length})
      </h2>
      <p className="mt-1 text-xs text-muted">
        Read from the placement itself — <span className="text-ink">featured_until</span> for a
        featured listing, the sponsorship window for a corridor sponsor — so a placement stopped by
        hand stops appearing here even if the CRM row still says it is live. Nothing renews or
        charges by itself; every renewal is a fresh sale you press.
      </p>
      {renewals.length === 0 ? (
        <p className="mt-3 text-sm text-muted">No placement is near the end of its term.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {renewals.map((v) => (
            <li key={v.id} className="rounded-card border border-line bg-asphalt-800 p-4">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="break-words font-display text-base uppercase text-ink">{v.company}</p>
                <p
                  className={`text-xs font-bold uppercase tracking-widest ${
                    v.standing === 'approaching' ? 'text-ink' : 'text-diesel-300'
                  }`}
                >
                  {RENEWAL_STANDING_LABEL[v.standing]}
                </p>
              </div>
              <p className="mt-1 text-xs text-muted">
                {v.product}
                {v.term ? ` · ${BILLING_LABEL[v.term]}` : ''} ·{' '}
                {v.placement.kind === 'none'
                  ? 'no placement'
                  : v.placement.endsAt
                    ? `ends ${v.placement.endsAt.slice(0, 10)}`
                    : 'no end date recorded'}
                {' · '}
                {v.days > 0
                  ? `${v.days} ${v.days === 1 ? 'day' : 'days'} left`
                  : `ended ${-v.days} ${v.days === -1 ? 'day' : 'days'} ago`}
              </p>
              {/* REVENUE-3 preserved Model B: a renewal runs from the day it is
                  pressed. Saying so here is the difference between an informed
                  decision and an accidental refund of days already paid for. */}
              {v.renewalCost && (
                <p className="mt-2 rounded-card border border-signal bg-signal/10 px-3 py-2 text-xs text-ink">
                  Renewing today replaces the {v.renewalCost.unusedDays} paid{' '}
                  {v.renewalCost.unusedDays === 1 ? 'day' : 'days'} still left on this term rather
                  than adding to them. Renew on the last day to give none of it away.
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-3">
                <Link href={`?open=${v.id}`} className={`${btnGhost} inline-flex items-center`}>
                  Open the opportunity
                </Link>
                {activationHandoffHref(v) && (
                  <Link
                    href={activationHandoffHref(v)!}
                    className={`${btnGhost} inline-flex items-center`}
                  >
                    Renew on the placements console
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ---------------------------------------------------- the full list */}
      <h2 className="mt-10 font-display text-lg uppercase text-ink">
        All opportunities ({filtered.length}
        {filtered.length !== views.length ? ` of ${views.length}` : ''})
      </h2>

      {views.length > 0 && (
        <form method="get" className="mt-3 grid gap-3 sm:grid-cols-4">
          <label className={`${label} sm:col-span-2`}>
            Business
            <input name="q" defaultValue={filter.q ?? ''} placeholder="Search…" className={input} />
          </label>
          <label className={label}>
            Pile
            <select name="bucket" defaultValue={filter.bucket ?? ''} className={input}>
              <option value="">Any</option>
              {[...MONEY_BUCKETS, 'live', 'later', 'lost'].map((b) => (
                <option key={b} value={b}>
                  {BUCKET_LABEL[b as keyof typeof BUCKET_LABEL]}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Product
            <select name="offer" defaultValue={filter.offerId ?? ''} className={input}>
              <option value="">Any</option>
              {OFFERS.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Follow-up
            <select name="na" defaultValue={filter.nextAction ?? ''} className={input}>
              <option value="">Any</option>
              {(['overdue', 'today', 'upcoming', 'none'] as const).map((n) => (
                <option key={n} value={n}>
                  {NEXT_ACTION_LABEL[n]}
                </option>
              ))}
            </select>
          </label>
          <div className="flex flex-wrap gap-2 sm:col-span-4">
            <button className={btnGhost}>Filter</button>
            <Link
              href="/admin/directory/revenue"
              className={`${btnGhost} inline-flex items-center`}
            >
              Clear
            </Link>
          </div>
        </form>
      )}

      {views.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nothing in the pipeline yet.</p>
      ) : filtered.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          Nothing matches that filter. Clear it to see all {views.length} opportunities.
        </p>
      ) : (
        <ul className="mt-3 space-y-3">
          {filtered.map((v) => (
            <OpportunityCard key={v.id} view={v} openHref={`?open=${v.id}`} showBucket />
          ))}
        </ul>
      )}

      {/* ------------------------------------------- open one by hand */}
      <h2 className="mt-10 font-display text-lg uppercase text-ink">Open an opportunity</h2>
      <p className="mt-1 text-xs text-muted">
        For a business you called yourself. An inbound inquiry through /sponsors arrives here on its
        own — this is for the ones you go and get. It records a conversation you have already had:
        nothing is sent, nobody is contacted, and no money is recorded until the quote and payment
        steps.
      </p>
      <form
        action={createOpportunityAction}
        className="mt-3 grid gap-3 rounded-card border border-line bg-asphalt-800 p-4 sm:grid-cols-2 sm:p-5"
      >
        <label className={label}>
          Business name
          <input name="company" required className={input} placeholder="Florence Truck Wash" />
        </label>
        <label className={label}>
          Who you spoke to
          <input name="contact_name" className={input} placeholder="Dale" />
        </label>
        <label className={label}>
          Email
          <input name="email" type="email" className={input} placeholder="dale@example.com" />
        </label>
        <label className={label}>
          Phone
          <input name="phone" className={input} placeholder="(555) 555-0100" />
        </label>
        <label className={`${label} sm:col-span-2`}>
          What happened
          <input
            name="note"
            className={input}
            placeholder="Owner is interested, wants to see the corridor page first"
          />
        </label>
        <label className={label}>
          Next step
          <input name="next_action" className={input} placeholder="Call back with the page" />
        </label>
        <label className={label}>
          Next step on
          <input type="date" name="next_action_date" defaultValue={today} className={input} />
        </label>
        <label className={label}>
          Opened by
          <input name="recorded_by" required placeholder="Shawn" className={input} />
        </label>
        <div className="flex items-end">
          <button className={btn}>Open opportunity</button>
        </div>
      </form>

      {/* ------------------------------------------------- the one open deal */}
      {open && (
        <section className="mt-10 rounded-card border border-signal bg-asphalt-800 p-5">
          <h2 className="break-words font-display text-lg uppercase text-ink">
            {open.row.company}
          </h2>
          <p className="mt-1 text-xs text-muted">
            {STAGE_LABEL[open.sale.stage]} · status {open.row.status ?? '—'} · quoted{' '}
            {formatPrice(open.sale.quotedCents)} · paid {formatPrice(open.sale.paidCents)}
            {open.sale.paymentConfirmed ? ' (confirmed)' : ' (unconfirmed)'}
          </p>
          {open.duplicates.length > 0 && (
            <p className="mt-3 rounded-card border border-diesel bg-diesel/10 px-3 py-2 text-xs text-diesel-300">
              ⚠ This business also appears on {open.duplicates.length} other row
              {open.duplicates.length === 1 ? '' : 's'} (
              {[...new Set(open.duplicates.map((d) => d.reason))].join(', ')}). Check before quoting
              or activating — one relationship, one placement.
            </p>
          )}

          {/* --- 1. contact --- */}
          <h3 className="mt-6 font-display text-base uppercase text-ink">1 · Record a contact</h3>
          <form action={addTouchAction} className="mt-2 grid gap-3 sm:grid-cols-4">
            <input type="hidden" name="sponsor_id" value={open.row.id} />
            <label className={label}>
              How
              <select name="touch_type" defaultValue="call" className={input}>
                {['call', 'email', 'dm', 'meeting', 'video', 'other'].map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Direction
              <select name="direction" defaultValue="outbound" className={input}>
                <option value="outbound">outbound</option>
                <option value="inbound">inbound</option>
              </select>
            </label>
            <label className={`${label} sm:col-span-2`}>
              What happened
              <input name="summary" className={input} placeholder="Left a voicemail" />
            </label>
            <div className="sm:col-span-4">
              <button className={btnGhost}>Record contact</button>
            </div>
          </form>

          {/* --- 2. qualify --- */}
          <h3 className="mt-6 font-display text-base uppercase text-ink">2 · Qualification</h3>
          <form action={recordQualificationAction} className="mt-2 grid gap-3 sm:grid-cols-4">
            <input type="hidden" name="sponsor_id" value={open.row.id} />
            <label className={`${label} sm:col-span-3`}>
              What you learned
              <input
                name="result"
                className={input}
                placeholder="Owner confirmed, two lots on I-75, decision is his"
              />
            </label>
            <label className={label}>
              Recorded by
              <input name="actor" className={input} placeholder="Shawn" />
            </label>
            <div className="sm:col-span-4">
              <button className={btnGhost}>Record qualification</button>
            </div>
          </form>

          {/* --- 3. stage --- */}
          <h3 className="mt-6 font-display text-base uppercase text-ink">3 · Move the stage</h3>
          <p className="mt-1 text-xs text-muted">
            One step at a time. From {STAGE_LABEL[open.sale.stage]} the pipeline allows:{' '}
            {STAGE_TRANSITIONS[open.sale.stage].map((s) => STAGE_LABEL[s]).join(', ') || 'nothing'}.
            Closing as lost needs a reason.
          </p>
          <form action={setStageAction} className="mt-2 grid gap-3 sm:grid-cols-4">
            <input type="hidden" name="sponsor_id" value={open.row.id} />
            <label className={label}>
              Move to
              <select name="stage" className={input}>
                {STAGE_TRANSITIONS[open.sale.stage].map((s) => (
                  <option key={s} value={s}>
                    {STAGE_LABEL[s]}
                  </option>
                ))}
              </select>
            </label>
            <label className={`${label} sm:col-span-2`}>
              Reason / note (required to close as lost)
              <input name="reason" className={input} />
            </label>
            <label className={label}>
              Recorded by
              <input name="actor" className={input} placeholder="Shawn" />
            </label>
            <div className="sm:col-span-4">
              <button className={btnGhost}>Move stage</button>
            </div>
          </form>

          {/* --- 4. quote --- */}
          <h3 className="mt-6 font-display text-base uppercase text-ink">4 · Record the offer</h3>
          <p className="mt-1 text-xs text-muted">
            Leave the amount blank to quote the standard price. A different figure is allowed but
            needs a written reason, and it applies to this deal only — it never changes the
            published price.
          </p>
          <form action={recordQuoteAction} className="mt-2 grid gap-3 sm:grid-cols-4">
            <input type="hidden" name="sponsor_id" value={open.row.id} />
            <label className={label}>
              Offer
              <select name="offer_id" defaultValue={open.sale.offerId ?? ''} className={input}>
                <option value="">Choose…</option>
                {paidOffers().map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.adminLabel}
                  </option>
                ))}
              </select>
            </label>
            <label className={label}>
              Term
              <select name="term" defaultValue={open.sale.term ?? 'annual'} className={input}>
                <option value="monthly">
                  Monthly — {formatPrice(standardAmountCents('featured-listing', 'monthly'))} /{' '}
                  {formatPrice(standardAmountCents('corridor-sponsor', 'monthly'))}
                </option>
                <option value="annual">
                  Annual — {formatPrice(standardAmountCents('featured-listing', 'annual'))} /{' '}
                  {formatPrice(standardAmountCents('corridor-sponsor', 'annual'))}
                </option>
              </select>
            </label>
            <label className={label}>
              Amount (blank = standard)
              <input name="amount" inputMode="decimal" className={input} placeholder="999" />
            </label>
            <label className={label}>
              Recorded by
              <input name="actor" className={input} placeholder="Shawn" />
            </label>
            <label className={`${label} sm:col-span-4`}>
              Reason, if the amount is not the standard price
              <input name="reason" className={input} />
            </label>
            <div className="sm:col-span-4">
              <button className={btnGhost}>Record offer</button>
            </div>
          </form>

          {/* --- 5. payment --- */}
          <h3 className="mt-6 font-display text-base uppercase text-ink">5 · Record payment</h3>
          <p className="mt-1 text-xs text-muted">
            <span className="font-semibold text-ink">
              Never type a card number, bank account, or password here.
            </span>{' '}
            The platform stores no payment details and this form refuses text that looks like any.
            The reference is only something you already have — an invoice number, “check 1042”,
            “bank transfer”.
          </p>
          <form action={recordPaymentAction} className="mt-2 grid gap-3 sm:grid-cols-4">
            <input type="hidden" name="sponsor_id" value={open.row.id} />
            <label className={label}>
              Amount received
              <input name="amount" inputMode="decimal" required className={input} />
            </label>
            <label className={label}>
              Date received
              <input type="date" name="paid_on" defaultValue={today} required className={input} />
            </label>
            <label className={label}>
              Reference (optional)
              <input name="reference" className={input} placeholder="check 1042" />
            </label>
            <label className={label}>
              Recorded by
              <input name="actor" className={input} placeholder="Shawn" />
            </label>
            {/* The label is the touch target and is sized for it; the box stays a
                normal visual size. Tapping anywhere on the sentence toggles it. */}
            <label className="flex min-h-[44px] items-center gap-3 text-xs text-muted sm:col-span-4">
              <input type="checkbox" name="confirmed" value="yes" className="h-6 w-6 shrink-0" />
              <span>
                I have seen this money arrive. Nothing goes live on an unconfirmed payment.
              </span>
            </label>
            <div className="sm:col-span-4">
              <button className={btn}>Record payment</button>
            </div>
          </form>

          {/* --- 6. term --- */}
          <h3 className="mt-6 font-display text-base uppercase text-ink">6 · Record the term</h3>
          <p className="mt-1 text-xs text-muted">
            The end date is derived from the start and the agreed term, and it is what the renewal
            queue reads.
          </p>
          <form action={setRenewalAction} className="mt-2 grid gap-3 sm:grid-cols-4">
            <input type="hidden" name="sponsor_id" value={open.row.id} />
            <label className={label}>
              Term starts
              <input type="date" name="starts_on" defaultValue={today} required className={input} />
            </label>
            <div className="sm:col-span-4">
              <button className={btnGhost}>Record term</button>
            </div>
          </form>

          {/* --- next action --- */}
          <h3 className="mt-6 font-display text-base uppercase text-ink">Next action</h3>
          <form action={setNextActionAction} className="mt-2 grid gap-3 sm:grid-cols-4">
            <input type="hidden" name="sponsor_id" value={open.row.id} />
            <label className={`${label} sm:col-span-2`}>
              What happens next
              <input
                name="next_action"
                defaultValue={open.row.next_action ?? ''}
                className={input}
              />
            </label>
            <label className={label}>
              When
              <input
                type="date"
                name="next_action_date"
                defaultValue={open.row.next_action_date ?? ''}
                className={input}
              />
            </label>
            <label className={label}>
              Priority (1–5)
              <input
                name="priority"
                inputMode="numeric"
                defaultValue={String(open.row.priority ?? 3)}
                className={input}
              />
            </label>
            <div className="sm:col-span-4">
              <button className={btnGhost}>Save next action</button>
            </div>
          </form>

          {/* --- history --- */}
          <h3 className="mt-6 font-display text-base uppercase text-ink">History</h3>
          <p className="mt-1 text-xs text-muted">
            Append-only. A correction is a new line, never an edit of an old one.
          </p>
          <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap break-words rounded-card border border-line bg-asphalt p-3 text-xs text-muted">
            {open.row.notes?.trim() || 'Nothing recorded yet.'}
          </pre>

          <p className="mt-4 text-xs text-muted">
            Contact details for this business are deliberately not repeated on this console — they
            live on{' '}
            <Link href="/admin/sponsors" className="text-signal underline">
              the sponsor inbox
            </Link>
            .
          </p>
        </section>
      )}

      {/* -------------------------------------------------- prospect shortlist */}
      <h2 className="mt-10 font-display text-lg uppercase text-ink">
        Who to call first ({prospectQueue.prospects.length})
      </h2>
      <p className="mt-1 text-xs text-muted">
        Built only from the public directory: the business phone and website already printed on the
        listing page, the corridor it sits on, and how complete the listing is. There is no traffic
        estimate and no likelihood to buy here, because we hold neither. Nothing on this list has
        been contacted and nothing here sends anything —{' '}
        <span className="font-semibold text-ink">copying it is a decision you make</span>.
      </p>
      {prospectQueue.prospects.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          No eligible listing found. Eligibility is: published, not deleted, not already sponsored,
          not a held brand, in a category with somebody to sell to, and carrying a public business
          phone or website.
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs text-muted">
            Showing {prospectQueue.prospects.length} of {prospectQueue.eligible} eligible
            {prospectQueue.dropped > 0 ? ` — ${prospectQueue.dropped} not shown` : ''}. Candidates
            are read from a bounded query, so this is the best of what was read, not a census of the
            directory.
          </p>
          <div className="mt-3 overflow-x-auto rounded-card border border-line">
            <table className="w-full min-w-[800px] text-sm">
              <thead className="bg-asphalt-800 text-left text-muted">
                <tr>
                  <th className="px-4 py-3 font-semibold">Business</th>
                  <th className="px-4 py-3 font-semibold">Where</th>
                  <th className="px-4 py-3 font-semibold">Public contact</th>
                  <th className="px-4 py-3 font-semibold">Why it is on this list</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {prospectQueue.prospects.map((p) => (
                  <tr key={p.listing.id}>
                    <td className="px-4 py-3 align-top">
                      <div className="break-words text-ink">{p.listing.name}</div>
                      {p.listing.detailSlug && (
                        <Link
                          href={`/directory/location/${p.listing.detailSlug}`}
                          className="mt-1 inline-block break-all text-xs text-signal underline"
                        >
                          view listing
                        </Link>
                      )}
                      {p.existingCrmId && (
                        <div className="mt-1 text-xs font-semibold text-diesel-300">
                          ⚠ already in the CRM
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-muted">
                      <div className="break-words">
                        {[p.listing.city, p.listing.state].filter(Boolean).join(', ') || '—'}
                      </div>
                      <div className="mt-1 whitespace-nowrap text-xs">
                        {p.listing.interstate ?? '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-muted">
                      <div className="whitespace-nowrap">{p.listing.phone || '—'}</div>
                      <div className="mt-1 break-all text-xs">{p.listing.website || '—'}</div>
                    </td>
                    <td className="px-4 py-3 align-top text-xs text-muted">
                      <ul className="space-y-1">
                        {p.reasons.map((r) => (
                          <li key={r}>{r}</li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-signal">
              Copy the queue as plain text
            </summary>
            <textarea
              readOnly
              rows={8}
              aria-label="Outreach queue, public business details only"
              className="mt-2 w-full rounded-card border border-line bg-asphalt p-3 font-mono text-xs text-muted"
              value={outreachQueueLines(prospectQueue.prospects).join('\n')}
            />
            <p className="mt-1 text-xs text-muted">
              Public business details only. Nothing here is sent, and no message text is generated —
              the wording lives in docs/operations/first-paid-directory-sponsor.md, and you send it
              yourself.
            </p>
          </details>
        </>
      )}

      <p className="mt-10 text-xs text-muted">
        No payment processor, no card collection, no automated invoice, and no automated outreach
        exist anywhere in this flow. Capacity is checked against live data at the instant a
        placement is activated; it is an application check, not a database constraint, so two
        administrators activating the same page in the same second could still overrun it.
      </p>
    </div>
  );
}
