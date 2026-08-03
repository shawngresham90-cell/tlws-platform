import { Section } from '@/components/ui';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';
import { ClassroomCountdown } from '@/components/classroom/ClassroomCountdown';
import { AmazonListCta, CashAppCta } from '@/components/classroom/ClassroomCtas';
import {
  CAMPAIGN_CITY,
  CAMPAIGN_DESTINATION,
  CAMPAIGN_OPENS_LABEL,
  CAMPAIGN_PATH,
  MANIFEST_ROWS,
  SUPPLY_TIERS,
} from '@/lib/classroom/campaign';

export const metadata = buildMetadata({
  title: 'Supply the Classroom | Trucking Life Academy',
  description: `Help equip the Trucking Life Academy classroom in ${CAMPAIGN_CITY} before doors open ${CAMPAIGN_OPENS_LABEL}.`,
  path: CAMPAIGN_PATH,
});

/**
 * Supply the Classroom — the campaign front door, built to the approved
 * bill-of-lading design: a freight manifest for a room that does not exist
 * yet. Dark ground, Sodium Amber primary, Road Flare orange secondary,
 * condensed uppercase display type, bordered manifest rows throughout.
 *
 * CLAIM SAFETY. The reference copy ended the CTA block with a promise that
 * every supporter's name goes on the Founder Wall and into a launch film.
 * Neither is supported by this repository: Founder Wall records are created
 * by a manual admin action against a fixed set of PAID tiers with a `paid_at`
 * timestamp and capped positions (src/lib/community/founders.ts,
 * src/components/community/tiers.ts), there is no path that turns a wishlist
 * purchase or a Cash App transfer into a founder record, and "launch film"
 * appears nowhere in the codebase or docs. Amazon also does not reliably tell
 * a recipient who bought an item. Publishing that sentence would create an
 * obligation nobody could keep, so it is replaced with what is actually true:
 * the supplies become the room. See the PR for the full audit.
 *
 * SHIP-TO. The mockup states Amazon auto-fills the delivery address and keeps
 * the street line private. That is a setting inside a private Amazon account,
 * which cannot be verified from this codebase — so the public wording claims
 * only what is observable here: Amazon handles delivery through the wishlist
 * checkout, and no street address is displayed on this page. Only the city is
 * ever named.
 */

/** Shared bordered-row shell — the manifest visual language of the page. */
function ManifestRow({ children }: { children: React.ReactNode }) {
  return <div className="border-t-2 border-ink/15 py-6 first:border-t-0">{children}</div>;
}

export default function SupplyTheClassroomPage() {
  return (
    <>
      <JsonLd
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Supply the Classroom', path: CAMPAIGN_PATH },
        ])}
      />

      {/* ============================================= BILL OF LADING STRIP */}
      <Section className="!pb-0 !pt-10">
        <dl className="grid grid-cols-2 gap-px border-2 border-signal/50 bg-signal/20 sm:grid-cols-3 lg:grid-cols-5">
          {MANIFEST_ROWS.map((row) => (
            <div key={row.field} className="bg-asphalt px-4 py-3">
              <dt className="text-[0.625rem] uppercase tracking-[0.25em] text-flare-300">
                {row.field}
              </dt>
              <dd className="mt-1 font-display text-base uppercase tracking-wide text-ink">
                {row.value}
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      {/* ============================================================= HERO */}
      <Section className="!pb-10 !pt-10">
        <p className="text-xs uppercase tracking-[0.25em] text-signal">
          Classroom Manifest · Trucking Life Academy
        </p>
        <h1 className="display-section mt-4">The Room Is Empty.</h1>
        <p className="mt-5 max-w-2xl text-lg text-muted">
          There is a room in {CAMPAIGN_CITY} with a date on it and nothing inside. Everything a
          driver will learn in there still has to get there first. This is the load list.
        </p>

        <div className="mt-10 border-2 border-ink/15 bg-asphalt-700 p-6 sm:p-8">
          <h2 className="text-xs uppercase tracking-[0.25em] text-flare-300">Time to delivery</h2>
          <div className="mt-4">
            <ClassroomCountdown />
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
          <AmazonListCta placement="campaign_hero" />
          <CashAppCta placement="campaign_hero" />
        </div>
      </Section>

      {/* =========================================== WHY THIS LIST EXISTS */}
      <Section className="!py-10">
        <h2 className="display-section text-3xl sm:text-4xl">Why this list exists</h2>
        <div className="mt-6 max-w-4xl">
          <ManifestRow>
            <p className="text-muted">
              A list is honest. You can see exactly what the room needs, cover the one thing you
              want to cover, and watch it come off the list when somebody beats you to it. Nothing
              disappears into a general fund.
            </p>
          </ManifestRow>
          <ManifestRow>
            <p className="text-muted">
              It also means the money lands where it says it lands. You are not sending a donation
              and hoping — you are buying a specific item for a specific classroom, and it ships
              straight there.
            </p>
          </ManifestRow>
        </div>
      </Section>

      {/* ============================================= WHAT'S ON THE LOAD */}
      <Section className="!py-10">
        <h2 className="display-section text-3xl sm:text-4xl">What&rsquo;s on the load</h2>
        <p className="mt-4 max-w-2xl text-muted">
          Desks and seating. Boards and displays. The consumables a working classroom burns through
          every week, and the shared gear a whole class learns on. Exact items, quantities and
          prices live on the Amazon list — it is the only place that stays current.
        </p>
      </Section>

      {/* ============================================== CONTRIBUTION TIERS */}
      <Section className="!py-10">
        <h2 className="display-section text-3xl sm:text-4xl">Pick your weight class</h2>
        <div className="mt-6 border-2 border-ink/15">
          {SUPPLY_TIERS.map((tier, i) => (
            <div
              key={tier.id}
              className={`grid gap-2 p-5 sm:grid-cols-[9rem,1fr] sm:gap-6 sm:p-6 ${
                i > 0 ? 'border-t-2 border-ink/15' : ''
              }`}
            >
              <p className="font-display text-2xl uppercase leading-none text-signal">
                {tier.range}
              </p>
              <div>
                <h3 className="font-display text-lg uppercase tracking-wide text-ink">
                  {tier.title}
                </h3>
                <p className="mt-2 text-sm text-muted">{tier.blurb}</p>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* ===================================================== TWO WAYS IN */}
      <Section className="!py-10">
        <h2 className="display-section text-3xl sm:text-4xl">Two ways in</h2>
        <div className="mt-6 grid gap-px border-2 border-ink/15 bg-ink/15 md:grid-cols-2">
          <div className="bg-asphalt-700 p-6 sm:p-8">
            <p className="text-[0.625rem] uppercase tracking-[0.25em] text-signal">Primary</p>
            <h3 className="mt-2 font-display text-xl uppercase text-ink">Buy off the list</h3>
            <p className="mt-3 text-sm text-muted">
              Pick a real item, and Amazon ships it to the classroom. This is the fastest way to
              help and the only one that knows what is still missing.
            </p>
            <AmazonListCta placement="two_ways_in" className="mt-6 w-full sm:w-auto" />
          </div>
          <div className="bg-asphalt-700 p-6 sm:p-8">
            <p className="text-[0.625rem] uppercase tracking-[0.25em] text-flare-300">Secondary</p>
            <h3 className="mt-2 font-display text-xl uppercase text-ink">Send supply money</h3>
            <p className="mt-3 text-sm text-muted">
              For the gaps a list cannot hold — a delivery charge, a local pickup, something nobody
              thought of. Every dollar goes into the same room.
            </p>
            <CashAppCta placement="two_ways_in" className="mt-6 w-full sm:w-auto" />
          </div>
        </div>
      </Section>

      {/* ========================================================= SHIP TO */}
      <Section className="!py-10">
        <h2 className="display-section text-3xl sm:text-4xl">Ship to</h2>
        <div className="mt-6 max-w-4xl border-2 border-ink/15">
          <div className="grid gap-2 p-5 sm:grid-cols-[9rem,1fr] sm:gap-6 sm:p-6">
            <p className="text-[0.625rem] uppercase tracking-[0.25em] text-flare-300">Consignee</p>
            <p className="font-display text-lg uppercase text-ink">
              Trucking Life Academy · {CAMPAIGN_DESTINATION}
            </p>
          </div>
          <div className="grid gap-2 border-t-2 border-ink/15 p-5 sm:grid-cols-[9rem,1fr] sm:gap-6 sm:p-6">
            <p className="text-[0.625rem] uppercase tracking-[0.25em] text-flare-300">Delivery</p>
            <p className="text-sm text-muted">
              Amazon handles delivery through the wishlist checkout. The private street address is
              not displayed on this page.
            </p>
          </div>
        </div>
      </Section>

      {/* ====================================== CLOSING: TLA IDENTITY */}
      <Section className="!pb-20 !pt-10">
        <div className="border-2 border-signal/40 bg-asphalt-700 p-8 sm:p-10">
          <p className="text-xs uppercase tracking-[0.25em] text-signal">Trucking Life Academy</p>
          <h2 className="display-section mt-3 text-3xl sm:text-4xl">Built by drivers.</h2>
          <p className="mt-4 max-w-2xl text-muted">
            Every item bought off that list becomes part of the room drivers train in — the desks
            they sit at, the boards they learn from, the gear they put their hands on. The classroom
            opens because people who already drive for a living decided it should.
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
            <AmazonListCta placement="campaign_footer" />
            <CashAppCta placement="campaign_footer" />
          </div>
        </div>
      </Section>
    </>
  );
}
