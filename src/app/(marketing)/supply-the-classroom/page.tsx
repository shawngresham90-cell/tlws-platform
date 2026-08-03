import { Section, Eyebrow } from '@/components/ui';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';
import { ClassroomCountdown } from '@/components/classroom/ClassroomCountdown';
import { AmazonListCta, CashAppCta } from '@/components/classroom/ClassroomCtas';
import {
  CAMPAIGN_CITY,
  CAMPAIGN_OPENS_LABEL,
  CAMPAIGN_PATH,
  SUPPLY_TIERS,
} from '@/lib/classroom/campaign';

export const metadata = buildMetadata({
  title: 'Supply the Classroom | Trucking Life Academy',
  description: `Help equip the Trucking Life Academy classroom in ${CAMPAIGN_CITY} before doors open ${CAMPAIGN_OPENS_LABEL}.`,
  path: CAMPAIGN_PATH,
});

/**
 * Supply the Classroom — the campaign front door.
 *
 * Built to the approved campaign concept: a freight manifest for a room that
 * does not exist yet. The Amazon list is the primary action because it is the
 * only surface that knows what is still needed; Cash App is secondary, for
 * the things a list cannot cover.
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
 * Only the city is ever named. No street address appears on this page — the
 * delivery address lives inside the Amazon list.
 */
export default function SupplyTheClassroomPage() {
  return (
    <>
      <JsonLd
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Supply the Classroom', path: CAMPAIGN_PATH },
        ])}
      />

      {/* ---------------------------------------------------- manifest head */}
      <Section className="!pb-10">
        <Eyebrow>Classroom Build Out</Eyebrow>
        <h1 className="display-section">The Room Is Empty</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          Trucking Life Academy has a room in {CAMPAIGN_CITY} and a date on the calendar. What it
          does not have yet is everything that goes inside it. This is the load list.
        </p>

        {/* Freight manifest: the campaign stated as a bill of lading. */}
        <dl className="mt-10 grid gap-px overflow-hidden rounded-card border-2 border-ink/20 bg-ink/20 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { term: 'Shipper', detail: 'Drivers, everywhere' },
            { term: 'Destination', detail: CAMPAIGN_CITY },
            { term: 'Delivery Date', detail: CAMPAIGN_OPENS_LABEL },
            { term: 'Status', detail: 'Loading' },
          ].map((row) => (
            <div key={row.term} className="bg-asphalt-700 p-5">
              <dt className="text-xs uppercase tracking-[0.2em] text-muted">{row.term}</dt>
              <dd className="mt-2 font-display text-xl uppercase text-ink">{row.detail}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-10">
          <h2 className="text-xs uppercase tracking-[0.2em] text-muted">Time to delivery</h2>
          <div className="mt-3">
            <ClassroomCountdown />
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
          <AmazonListCta placement="campaign_hero" />
          <CashAppCta placement="campaign_hero" />
        </div>
        <p className="mt-4 max-w-2xl text-sm text-muted">
          The Amazon list is the fastest way to help — it is the only place that knows what is still
          missing.
        </p>
      </Section>

      {/* ------------------------------------------------- why a list exists */}
      <Section className="!pt-6">
        <h2 className="display-section text-3xl sm:text-4xl">Why a list instead of a fundraiser</h2>
        <div className="mt-5 grid max-w-4xl gap-5 text-muted md:grid-cols-2">
          <p>
            A list is honest. You can see exactly what the classroom needs, pick the thing you want
            to cover, and watch it come off the list when someone else gets there first. Nothing
            disappears into a general fund.
          </p>
          <p>
            It also means the money goes where it says it goes. You are not sending a donation and
            hoping — you are buying a specific item for a specific room, and Amazon delivers it
            straight there.
          </p>
        </div>
      </Section>

      {/* --------------------------------------------------------- the tiers */}
      <Section className="!pt-6">
        <h2 className="display-section text-3xl sm:text-4xl">Pick your weight class</h2>
        <p className="mt-4 max-w-2xl text-muted">
          Every load gets there the same way — one piece at a time. Exact items, quantities and
          prices live on the Amazon list, which is the only place that stays current.
        </p>
        <ul className="mt-8 grid gap-5 sm:grid-cols-2">
          {SUPPLY_TIERS.map((tier) => (
            <li key={tier.id} className="rounded-card border-2 border-ink/15 bg-asphalt-700 p-6">
              <p className="font-display text-2xl uppercase text-signal">{tier.range}</p>
              <h3 className="mt-2 font-display text-lg uppercase text-ink">{tier.title}</h3>
              <p className="mt-2 text-sm text-muted">{tier.blurb}</p>
            </li>
          ))}
        </ul>
      </Section>

      {/* --------------------------------------------- shipping and privacy */}
      <Section className="!pt-6">
        <h2 className="display-section text-3xl sm:text-4xl">Shipping and privacy</h2>
        <div className="mt-5 grid max-w-4xl gap-5 text-muted md:grid-cols-2">
          <p>
            Delivery is handled entirely by Amazon through the list. The shipping address is held
            inside the list itself and is never displayed on this page — you do not need it, and
            publishing it is not something a school should do.
          </p>
          <p>
            If you would rather cover something that is not on the list — a delivery charge, a local
            pickup, a gap nobody thought of — Cash App is there for that. Every dollar goes into the
            same room.
          </p>
        </div>

        <div className="mt-10 rounded-card border-2 border-signal/40 bg-asphalt-700 p-6">
          <h3 className="font-display text-xl uppercase text-ink">What your help actually does</h3>
          <p className="mt-3 max-w-2xl text-muted">
            Every item bought off that list becomes part of the room drivers train in — the desks
            they sit at, the boards they learn from, the gear they put their hands on. The classroom
            opens because people who already drive for a living decided it should.
          </p>
          <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap">
            <AmazonListCta placement="campaign_footer" />
            <CashAppCta placement="campaign_footer" />
          </div>
        </div>
      </Section>
    </>
  );
}
