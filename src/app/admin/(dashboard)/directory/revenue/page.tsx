import Link from 'next/link';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  BILLING_LABEL,
  OFFERS,
  formatPrice,
  getOffer,
  paidOffers,
  priceLabel,
  standardAmountCents,
} from '@/lib/directory/offers';
import {
  RENEWAL_LEAD_DAYS,
  SPONSOR_STAGES,
  STAGE_LABEL,
  STAGE_TRANSITIONS,
  findDuplicates,
  isoDay,
  pipelineSummary,
  rate,
  readSaleState,
  renewalView,
  saleActivationBlockers,
  type SponsorSaleRow,
} from '@/lib/directory/revenue';
import { FEATURED_PER_PAGE, PRIMARY_CORRIDOR_SPONSORS } from '@/lib/directory/placements';
import { parseDirectoryInquiry } from '@/lib/admin/directory-inquiry';
import {
  MONETIZABLE_CATEGORIES,
  outreachQueueLines,
  shortlist,
  type ProspectListing,
} from '@/lib/directory/prospects';
import {
  addTouchAction,
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

async function load(): Promise<{ ok: boolean; rows: RawRow[]; listings: ProspectListing[] }> {
  try {
    const supabase = createAdminClient();
    const [crm, candidates] = await Promise.all([
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
    ]);
    if (crm.error) return { ok: false, rows: [], listings: [] };
    return {
      ok: true,
      rows: (crm.data as unknown as RawRow[]) ?? [],
      listings: ((candidates.data as Record<string, unknown>[]) ?? []).map(toProspectListing),
    };
  } catch {
    return { ok: false, rows: [], listings: [] };
  }
}

const input = 'w-full rounded-card border border-line bg-asphalt px-3 py-2 text-sm text-ink';
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

  const { ok: loaded, rows, listings } = await load();
  const now = new Date();
  const today = isoDay(now);
  const saleRows = rows.map(toSaleRow);
  const summary = pipelineSummary(saleRows, now);

  const contacted = summary.total - summary.byStage.prospect;
  const contactRate = rate(contacted, summary.total);
  const warmRate = rate(
    summary.byStage.warm + summary.byStage.committed + summary.byStage.closed_won,
    summary.total,
  );
  const paidRate = rate(summary.paid + summary.active, summary.total);

  const enriched = rows.map((r) => {
    const sale = readSaleState(toSaleRow(r));
    const dir = parseDirectoryInquiry(r.tier_interest, r.notes);
    const isLive = r.status === 'active';
    const renewal = renewalView(sale.offerId, sale.renewalDate, isLive, now);
    const duplicates = findDuplicates(
      { id: r.id, company: r.company, email: r.email, phone: r.phone },
      rows.map((o) => ({ id: o.id, company: o.company, email: o.email, phone: o.phone })),
    );
    return { row: r, sale, dir, isLive, renewal, duplicates };
  });

  const renewalQueue = enriched
    .filter((e) => e.isLive && (e.renewal.state === 'due' || e.renewal.state === 'overdue'))
    .sort((a, b) => (a.sale.renewalDate ?? '').localeCompare(b.sale.renewalDate ?? ''));

  const awaiting = enriched.filter(
    (e) =>
      !e.isLive &&
      e.sale.paymentConfirmed &&
      e.sale.paidCents > 0 &&
      (e.sale.stage === 'committed' || e.sale.stage === 'closed_won'),
  );

  const open = enriched.find((e) => e.row.id === openId) ?? null;

  const queue = shortlist(
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

      {/* ------------------------------------------------------- summary */}
      <h2 className="mt-10 font-display text-lg uppercase text-ink">Pipeline</h2>
      {summary.total === 0 ? (
        <p className="mt-2 rounded-card border border-line bg-asphalt-800 p-4 text-sm text-muted">
          No inquiries yet. There is nothing to summarise and no conversion rate to show — a rate
          over zero inquiries would be an invented number, not a result. The first inquiry through{' '}
          <Link href="/sponsors" className="text-signal underline">
            /sponsors
          </Link>{' '}
          appears here.
        </p>
      ) : (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {SPONSOR_STAGES.map((s) => (
              <Tile key={s} label={STAGE_LABEL[s]} value={String(summary.byStage[s])} />
            ))}
            <Tile label="Payment recorded" value={String(summary.paid)} />
            <Tile label="Placement live" value={String(summary.active)} />
            <Tile
              label="Paid, awaiting activation"
              value={String(summary.awaitingActivation)}
              tone={summary.awaitingActivation > 0 ? 'warn' : undefined}
            />
            <Tile
              label="Renewal due"
              value={String(summary.renewalDue)}
              tone={summary.renewalDue > 0 ? 'warn' : undefined}
            />
            <Tile
              label="Renewal overdue"
              value={String(summary.renewalOverdue)}
              tone={summary.renewalOverdue > 0 ? 'warn' : undefined}
            />
            <Tile
              label="Overdue next actions"
              value={String(summary.overdueNextActions)}
              tone={summary.overdueNextActions > 0 ? 'warn' : undefined}
            />
            <Tile label="Open pipeline" value={formatPrice(summary.openPipelineCents)} />
            <Tile label="Collected" value={formatPrice(summary.collectedCents)} />
          </div>
          <p className="mt-3 text-xs text-muted">
            Contacted {contactRate === null ? 'no data' : `${contactRate}%`} · warm or better{' '}
            {warmRate === null ? 'no data' : `${warmRate}%`} · paid{' '}
            {paidRate === null ? 'no data' : `${paidRate}%`}. Pipeline and collected figures are
            sums of amounts explicitly recorded on a deal — nothing is estimated or forecast.
          </p>
        </>
      )}

      {/* ------------------------------------------------------- renewals */}
      <h2 className="mt-10 font-display text-lg uppercase text-ink">
        Renewals and expiry ({renewalQueue.length})
      </h2>
      <p className="mt-1 text-xs text-muted">
        A corridor sponsor stops showing the moment its window passes. A featured listing{' '}
        <span className="font-semibold text-ink">does not</span> — the column behind it is a bare
        boolean with no end date, so its term ending is a job for a human, and this queue is where
        that job appears. Rows show inside {RENEWAL_LEAD_DAYS} days of the recorded term end.
      </p>
      {renewalQueue.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          {summary.active === 0
            ? 'No placement is live, so nothing can be due.'
            : 'Nothing due or overdue.'}
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {renewalQueue.map((e) => (
            <li
              key={e.row.id}
              className={`rounded-card border p-4 ${
                e.renewal.needsManualStop
                  ? 'border-diesel bg-diesel/10'
                  : 'border-line bg-asphalt-800'
              }`}
            >
              <p className="break-words font-display text-base uppercase text-ink">
                {e.row.company}
              </p>
              <p className="mt-1 text-xs text-muted">
                {e.sale.offerId ? getOffer(e.sale.offerId).name : 'No offer recorded'} ·{' '}
                {e.sale.term ? BILLING_LABEL[e.sale.term] : 'no term'} · term ends{' '}
                {fmtDay(e.sale.renewalDate)}
              </p>
              <p
                className={`mt-1 text-xs font-semibold ${
                  e.renewal.needsManualStop ? 'text-diesel-300' : 'text-ink'
                }`}
              >
                {e.renewal.needsManualStop ? '⚠ ' : ''}
                {e.renewal.label}
              </p>
              <Link
                href="/admin/directory/placements"
                className="mt-2 inline-block text-xs text-signal underline"
              >
                Stop or renew on the placements console →
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* --------------------------------------------- awaiting activation */}
      <h2 className="mt-10 font-display text-lg uppercase text-ink">
        Paid, ready to activate ({awaiting.length})
      </h2>
      {awaiting.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nothing is paid and waiting.</p>
      ) : (
        <ul className="mt-3 space-y-2">
          {awaiting.map((e) => {
            const kind =
              e.sale.offerId === 'corridor-sponsor'
                ? ('corridor-sponsor' as const)
                : e.sale.offerId === 'featured-listing'
                  ? ('featured-listing' as const)
                  : null;
            const blockers = kind
              ? saleActivationBlockers(kind, e.sale, { startsAt: null, endsAt: null })
              : ['No placement offer is recorded, so there is nothing to activate.'];
            return (
              <li key={e.row.id} className="rounded-card border border-line bg-asphalt-800 p-4">
                <p className="break-words font-display text-base uppercase text-ink">
                  {e.row.company}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {e.sale.offerId ? getOffer(e.sale.offerId).name : '—'} ·{' '}
                  {e.sale.term ? BILLING_LABEL[e.sale.term] : 'no term'} ·{' '}
                  {formatPrice(e.sale.paidCents)} paid {e.sale.paidOn ?? ''}
                </p>
                {blockers.length === 0 ? (
                  <p className="mt-2 text-xs text-ink">
                    Sale checks pass. Copy this CRM row id into the placements console:{' '}
                    <code className="break-all text-signal">{e.row.id}</code>
                  </p>
                ) : (
                  <p className="mt-2 text-xs text-diesel-300">{blockers.join(' ')}</p>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* ---------------------------------------------------- the pipeline */}
      <h2 className="mt-10 font-display text-lg uppercase text-ink">
        Opportunities ({rows.length})
      </h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted">Nothing in the pipeline yet.</p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-card border border-line">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="bg-asphalt-800 text-left text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Business</th>
                <th className="px-4 py-3 font-semibold">Offer</th>
                <th className="px-4 py-3 font-semibold">Stage</th>
                <th className="px-4 py-3 font-semibold">Money</th>
                <th className="px-4 py-3 font-semibold">Next action</th>
                <th className="px-4 py-3 font-semibold">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {enriched.map((e) => {
                const overdue =
                  !e.row.next_action?.trim() ||
                  (e.sale.renewalDate !== null && e.sale.renewalDate < today);
                return (
                  <tr key={e.row.id}>
                    <td className="px-4 py-3 align-top">
                      <div className="break-words text-ink">{e.row.company}</div>
                      {e.duplicates.length > 0 && (
                        <div className="mt-1 text-xs font-semibold text-diesel-300">
                          ⚠ {e.duplicates.length} possible duplicate
                          {e.duplicates.length === 1 ? '' : 's'} (
                          {[...new Set(e.duplicates.map((d) => d.reason))].join(', ')}) — check
                          before selling twice
                        </div>
                      )}
                      {e.dir.source && (
                        <div className="mt-1 text-xs text-muted">Source: {e.dir.source}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 align-top text-muted">
                      <div className="whitespace-nowrap">
                        {e.sale.offerId
                          ? getOffer(e.sale.offerId).name
                          : (e.row.tier_interest ?? '—')}
                      </div>
                      <div className="mt-1 whitespace-nowrap text-xs">
                        {e.sale.term ? BILLING_LABEL[e.sale.term] : 'no term agreed'}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div className="whitespace-nowrap text-muted">
                        {STAGE_LABEL[e.sale.stage]}
                      </div>
                      <div className="mt-1 whitespace-nowrap text-xs text-muted">
                        status: {e.row.status ?? '—'}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top text-muted">
                      <div className="whitespace-nowrap">
                        quoted {formatPrice(e.sale.quotedCents)}
                      </div>
                      <div className="mt-1 whitespace-nowrap text-xs">
                        paid {formatPrice(e.sale.paidCents)}
                        {e.sale.paymentConfirmed ? ' · confirmed' : ' · unconfirmed'}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <div
                        className={`text-xs ${overdue ? 'font-semibold text-diesel-300' : 'text-muted'}`}
                      >
                        {e.row.next_action || 'None set'}
                      </div>
                      <div className="mt-1 whitespace-nowrap text-xs text-muted">
                        {fmtDay(e.row.next_action_date)}
                      </div>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Link
                        href={`?open=${e.row.id}`}
                        className="whitespace-nowrap text-xs text-signal underline"
                      >
                        {openId === e.row.id ? 'Open below ↓' : 'Manage →'}
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

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
            <label className="flex items-start gap-2 text-xs text-muted sm:col-span-4">
              <input type="checkbox" name="confirmed" value="yes" className="mt-0.5 h-5 w-5" />
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
        Who to call first ({queue.prospects.length})
      </h2>
      <p className="mt-1 text-xs text-muted">
        Built only from the public directory: the business phone and website already printed on the
        listing page, the corridor it sits on, and how complete the listing is. There is no traffic
        estimate and no likelihood-to-buy here, because we hold neither. Nothing on this list has
        been contacted and nothing here sends anything —{' '}
        <span className="font-semibold text-ink">copying it is a decision you make</span>.
      </p>
      {queue.prospects.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          No eligible listing found. Eligibility is: published, not deleted, not already sponsored,
          not a held brand, in a category with somebody to sell to, and carrying a public business
          phone or website.
        </p>
      ) : (
        <>
          <p className="mt-2 text-xs text-muted">
            Showing {queue.prospects.length} of {queue.eligible} eligible
            {queue.dropped > 0 ? ` — ${queue.dropped} not shown` : ''}. Candidates are read from a
            bounded query, so this is the best of what was read, not a census of the directory.
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
                {queue.prospects.map((p) => (
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
              value={outreachQueueLines(queue.prospects).join('\n')}
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
