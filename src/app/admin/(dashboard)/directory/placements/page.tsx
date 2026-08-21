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
} from '@/lib/directory/featured-window';
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

async function load(query: string, schema: FeaturedSchema) {
  try {
    const supabase = createAdminClient();
    const [featured, sponsors, matches] = await Promise.all([
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
    ]);
    return {
      ok: true,
      featured: ((featured.data as unknown as Record<string, unknown>[] | null) ?? []).map(
        toListing,
      ),
      sponsors: ((sponsors.data as Record<string, unknown>[]) ?? []).map(toSponsor),
      matches: ((matches.data as unknown as Record<string, unknown>[] | null) ?? []).map(toListing),
    };
  } catch {
    return { ok: false, featured: [], sponsors: [], matches: [] };
  }
}

const input = 'w-full rounded-card border border-line bg-asphalt px-3 py-2 text-sm text-ink';
const label = 'block text-xs text-muted';
const btn =
  'rounded-card bg-signal px-4 py-2 font-display text-sm uppercase tracking-wide text-asphalt hover:bg-signal-600';
const btnGhost = 'rounded-card border border-line px-3 py-1.5 text-xs text-ink hover:border-signal';

const today = () => new Date().toISOString().slice(0, 10);
const fmt = (iso: string | null) => (iso ? iso.slice(0, 10) : '—');

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

  const schema = await adminFeaturedSchema();
  const now = new Date();
  const { ok: loaded, featured, sponsors, matches } = await load(query, schema);

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
          A featured listing now carries its own end date and stops showing the moment the term
          passes — no action needed, exactly like a corridor sponsor. A row left flagged after that
          is housekeeping, not a live placement: it is already off every public page.
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
          {featured.map((l) => (
            <li
              key={l.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-card border border-line bg-asphalt-800 p-4"
            >
              <div>
                <p className="font-display text-base uppercase text-ink">{l.name}</p>
                <p className="text-xs text-muted">
                  {[l.categorySlug, l.city, l.state, l.interstate].filter(Boolean).join(' · ')}
                  {!l.isPublished && ' · NOT PUBLISHED'}
                </p>
                {/* Status carries a word, never a colour alone. */}
                <p
                  className={`mt-1 text-xs font-semibold ${
                    featuredStatus.get(l.id) === 'active' ? 'text-ink' : 'text-diesel-300'
                  }`}
                >
                  {FEATURED_STATUS_LABEL[featuredStatus.get(l.id) ?? 'inactive']}
                  {l.featuredUntil ? ` · term ends ${l.featuredUntil.slice(0, 10)}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <form action={deactivateFeaturedAction} className="flex flex-wrap items-end gap-2">
                  <input type="hidden" name="listing_id" value={l.id} />
                  <label className={label}>
                    Reviewer
                    <input name="reviewer" className={`${input} w-32`} placeholder="Shawn" />
                  </label>
                  <label className={label}>
                    CRM row id (for the audit trail)
                    <input name="sponsor_id" className={`${input} w-44`} />
                  </label>
                  <button className={btnGhost}>Stop sponsorship</button>
                </form>

                {/* Renewal is a SECOND SALE, so it asks for the same things
                    activation does and refuses on the same grounds. It can
                    restore a placement whose term already lapsed. */}
                {schema === 'ready' && (
                  <form action={renewFeaturedAction} className="flex flex-wrap items-end gap-2">
                    <input type="hidden" name="listing_id" value={l.id} />
                    <label className={label}>
                      Renew for
                      <select name="billing" defaultValue="monthly" className={`${input} w-28`}>
                        <option value="monthly">Monthly</option>
                        <option value="annual">Annual</option>
                      </select>
                    </label>
                    <label className={label}>
                      Reviewer
                      <input name="reviewer" className={`${input} w-32`} placeholder="Shawn" />
                    </label>
                    <label className={label}>
                      Paying CRM row id
                      <input name="sponsor_id" required className={`${input} w-44`} />
                    </label>
                    <label className={label}>
                      Type ACTIVATE
                      <input name="confirm" autoComplete="off" className={`${input} w-28`} />
                    </label>
                    <button className={btnGhost}>Renew</button>
                  </form>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* ------------------------------------------- activate a featured listing */}
      <h2 className="mt-10 font-display text-lg uppercase text-ink">Activate a featured listing</h2>
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

      {matches.map((l) => {
        const blockers = promotionBlockers(l);
        const usage = featuredUsage(l, featured, now, schema);
        const full =
          usage.category.used >= usage.category.limit ||
          (usage.corridor != null && usage.corridor.used >= usage.corridor.limit);
        return (
          <div key={l.id} className="mt-4 rounded-card border border-line bg-asphalt-800 p-4">
            <p className="font-display text-base uppercase text-ink">{l.name}</p>
            <p className="text-xs text-muted">
              {[l.categorySlug, l.city, l.state, l.interstate].filter(Boolean).join(' · ')} ·{' '}
              {usage.category.slug} page {usage.category.used}/{usage.category.limit}
              {usage.corridor
                ? ` · ${usage.corridor.corridor} page ${usage.corridor.used}/${usage.corridor.limit}`
                : ''}
            </p>

            {isHeldBrand(l.name) && (
              <p className="mt-2 rounded-card border border-diesel bg-diesel/10 px-3 py-2 text-xs text-diesel-300">
                Held brand — this listing is never promoted.
              </p>
            )}
            {blockers.length > 0 && !isHeldBrand(l.name) && (
              <p className="mt-2 text-xs text-diesel-300">{blockers.join(' ')}</p>
            )}
            {full && (
              <p className="mt-2 text-xs text-diesel-300">
                A page this listing appears on is already at capacity.
              </p>
            )}
            {l.isFeatured && <p className="mt-2 text-xs text-muted">Already sponsored.</p>}

            {schema !== 'ready' && !l.isFeatured && (
              <p className="mt-2 rounded-card border border-diesel bg-diesel/10 px-3 py-2 text-xs text-diesel-300">
                Activation is blocked until migration 057 is applied. Switching a listing on now
                would give it no expiry, which is exactly what this milestone removes.
              </p>
            )}
            {schema === 'ready' && blockers.length === 0 && !full && !l.isFeatured && (
              <form action={activateFeaturedAction} className="mt-3 grid gap-3 sm:grid-cols-3">
                <input type="hidden" name="listing_id" value={l.id} />
                <label className={label}>
                  Billing
                  <select name="billing" defaultValue="monthly" className={input}>
                    <option value="monthly">
                      Monthly — {priceLabel(OFFERS[1]).split(' or ')[0]}
                    </option>
                    <option value="annual">
                      Annual — {priceLabel(OFFERS[1]).split(' or ')[1]}
                    </option>
                  </select>
                </label>
                {/* MODEL B: the window is derived, so there is nothing to type
                    and nothing to get wrong. The term starts on activation and
                    the end follows from the billing period — the date written to
                    the row and the date the public pages honour are one value.
                    A future start was previously accepted here and then ignored
                    by every public surface; that field is gone rather than
                    lying. */}
                <p className="text-xs text-muted sm:col-span-3">
                  Term: starts the moment you activate, ends automatically one {'month or year'}{' '}
                  later depending on the billing period above. The exact end date is written to the
                  listing and shown here once it is live.
                </p>
                <label className={label}>
                  Reviewer
                  <input name="reviewer" placeholder="Shawn" className={input} />
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
                  <p className="mt-2 text-sm text-ink">
                    {l.name}{' '}
                    <span className="rounded-card border border-line px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-muted">
                      Sponsored
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    Sorted first on the {usage.category.slug} page
                    {usage.corridor ? ` and the ${usage.corridor.corridor} page` : ''}, with a
                    Sponsored badge on the card and the detail page. Its hours, services, parking
                    and reviews are unchanged — payment never edits a listing.
                  </p>
                </div>
                <p className="text-xs text-muted sm:col-span-3">
                  This is refused unless the CRM opportunity is committed or closed-won, has the
                  featured-listing offer and an agreed term recorded, and has a confirmed payment
                  covering the agreed amount. The placement then ends on its own at the end of the
                  term. Record all of that on{' '}
                  <Link href="/admin/directory/revenue" className="text-signal underline">
                    the revenue console
                  </Link>{' '}
                  first.
                </p>
                <div className="sm:col-span-3">
                  <button className={btn}>Activate featured listing</button>
                </div>
              </form>
            )}
          </div>
        );
      })}

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
