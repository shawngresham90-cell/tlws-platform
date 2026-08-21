import { Section, Eyebrow } from '@/components/ui';
import { SponsorInquiryForm } from '@/components/sponsors/SponsorInquiryForm';
import { boundToken, boundState, corridorLabel } from '@/lib/directory/funnel';
import { OfferTable } from '@/components/directory';
import { SPONSOR_PLACEMENTS } from '@/lib/directory/sponsors';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';
import { SITE } from '@/lib/seo/site';

export const metadata = buildMetadata({
  title: 'Sponsor the School — Reach Working Drivers | Trucking Life Academy',
  description:
    'Partner with Trucking Life with Shawn: sponsor equipment, students, or the school itself, and reach a loyal driver audience across the site, directory, and channel.',
  path: '/sponsors',
});

/**
 * Sponsor front door. Describes the real placement inventory (the same
 * placements the directory sponsor system serves), publishes the three
 * approved Directory offers, and files inquiries into the existing CRM
 * pipeline via /api/sponsor-inquiry.
 *
 * Every price on this page is read from the offer authority
 * (src/lib/directory/offers.ts) — nothing here is typed by hand, so the table
 * and the form's dropdown cannot disagree. Sending the form is an inquiry: it
 * takes no payment, holds no slot, and activates nothing.
 */
const PLACEMENT_BLURBS: Record<string, string> = {
  'directory-hub': 'The front page of the truck stop & parking directory.',
  state: 'Every state landing page a driver browses for stops.',
  interstate: 'Corridor pages for the interstates your customers actually run.',
  detail: 'Individual truck stop and parking listing pages.',
  'map-sidebar': 'Beside the interactive directory map.',
  parking: 'The truck parking landing pages drivers check nightly.',
};

const WAYS = [
  {
    title: 'Founding Sponsor',
    text: 'Put your name on the school as it launches — equipment, classroom, or the build itself. Founding sponsors are part of the story from day one.',
  },
  {
    title: 'Sponsor a student',
    text: 'Fund a seat and put a driver on the road. Community-funded training is the heart of the mission — drivers helping drivers, made real.',
  },
  {
    title: 'Directory placements',
    text: 'Reach drivers while they plan the drive: sponsored slots across the truck stop directory, corridor pages, and the map.',
  },
];

export default function SponsorsPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
  // A directory "Get featured" CTA can deep-link with the interest
  // preselected; the form validates it against the allowed options.
  const rawInterest = searchParams?.interest;
  const defaultInterest = Array.isArray(rawInterest) ? rawInterest[0] : rawInterest;
  // A directory listing CTA (claim / featured placement) also passes the
  // listing it refers to. Every value is re-bounded here — the query string is
  // untrusted input — and only ever displayed back and appended to the message.
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const listing = {
    slug: boundToken(one(searchParams?.listing), 64) ?? undefined,
    name: boundToken(one(searchParams?.lname), 64) ?? undefined,
    category: boundToken(one(searchParams?.lcat), 32) ?? undefined,
    state: boundState(one(searchParams?.lstate)) ?? undefined,
    interstate: corridorLabel(one(searchParams?.lcorr)) ?? undefined,
  };
  // Where the visitor came from: a directory CTA surface, or a campaign token
  // on a link Shawn posted. Bounded, shown back, and the only campaign
  // attribution the CRM gets while analytics is switched off.
  const from = boundToken(one(searchParams?.from), 40) ?? undefined;
  return (
    <>
      <JsonLd
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Sponsors', path: '/sponsors' },
        ])}
      />

      <div className="border-b border-line bg-asphalt py-16 sm:py-20">
        <div className="mx-auto max-w-content px-5 sm:px-8">
          <Eyebrow>Sponsors</Eyebrow>
          <h1 className="display-hero max-w-3xl text-5xl sm:text-6xl">
            Partner with <span className="text-signal">the school.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            Trucking companies, suppliers, and local businesses can sponsor equipment, students, or
            the build itself — and reach a loyal driver audience across {SITE.brand}&apos;s site,
            directory, and channel while doing real good.
          </p>
        </div>
      </div>

      <Section className="border-b border-line">
        <Eyebrow>Ways to partner</Eyebrow>
        <h2 className="display-section mb-8">Three ways in</h2>
        <div className="grid gap-5 sm:grid-cols-3">
          {WAYS.map((w) => (
            <div key={w.title} className="rounded-card border border-line p-6">
              <h3 className="font-display text-xl uppercase text-signal">{w.title}</h3>
              <p className="mt-3 text-sm text-muted">{w.text}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section className="border-b border-line bg-asphalt-800">
        <Eyebrow>Placement inventory</Eyebrow>
        <h2 className="display-section mb-4">Where your name shows up</h2>
        {/* This paragraph used to end "contact us for current rates — nothing is
            published", immediately above a table publishing three prices. A
            business reading top to bottom was told rates are unpublished and
            then shown them. The two statements are about different things —
            these six placement slots are the inventory; the three offers below
            are the priced products — so say which is which. */}
        <p className="mb-8 max-w-2xl text-muted">
          Sponsored placements run across the truck stop &amp; parking directory — the same slots
          the platform serves today. The{' '}
          <span className="font-semibold text-ink">three offers below carry published prices</span>;
          anything outside them is quoted in conversation. Nothing is committed until we talk, and
          no placement is held on an inquiry.
        </p>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SPONSOR_PLACEMENTS.map((p) => (
            <li key={p.value} className="rounded-card border border-line bg-asphalt p-5">
              <p className="font-semibold text-ink">{p.label}</p>
              <p className="mt-1 text-sm text-muted">{PLACEMENT_BLURBS[p.value]}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-xs text-muted">
          Every sponsored link is disclosed and carries rel=&quot;sponsored&quot; — good for
          drivers, honest for search engines.
        </p>

        <h3 className="display-section mb-4 mt-12">Directory offers</h3>
        <OfferTable />
      </Section>

      <Section id="inquire" className="border-b border-line">
        <div className="mx-auto max-w-2xl">
          <Eyebrow>Start the conversation</Eyebrow>
          <h2 className="display-section mb-4">Tell us who you are</h2>
          <p className="mb-8 text-muted">
            One short form. Shawn reads every inquiry and replies personally — placements, goals,
            and rates all get sorted in that first conversation.
          </p>
          <SponsorInquiryForm
            siteKey={siteKey}
            defaultInterest={defaultInterest}
            listing={listing.slug ? listing : undefined}
            from={from}
          />
        </div>
      </Section>
    </>
  );
}
