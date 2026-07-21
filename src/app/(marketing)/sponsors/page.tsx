import { Section, Eyebrow } from '@/components/ui';
import { AcademyFaq } from '@/components/academy';
import { SponsorInquiryForm } from '@/components/sponsors/SponsorInquiryForm';
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
 * placements the directory sponsor system serves) and files inquiries into
 * the existing CRM pipeline via /api/sponsor-inquiry. No rates are published
 * — every engagement starts with a conversation.
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

/** Next delivers string | string[] | undefined; take the first value. */
function firstParam(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? '';
}

export default function SponsorsPage({
  searchParams,
}: {
  searchParams?: { interest?: string | string[]; context?: string | string[] };
}) {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
  // "Get featured" links on directory surfaces preselect the interest and
  // carry which surface sent the visitor, so inquiries arrive with context.
  const initialInterest = firstParam(searchParams?.interest).slice(0, 40);
  // Bounded so the composed tier_interest "<interest> (<context>)" always
  // fits the schema's 60 chars without chopping the closing paren.
  const context = firstParam(searchParams?.context).slice(0, 30);
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
        <p className="mb-8 max-w-2xl text-muted">
          Sponsored placements run across the truck stop &amp; parking directory — the same slots
          the platform serves today. Placements start small and scale with the audience;{' '}
          <span className="font-semibold text-ink">contact us for current rates</span> — nothing is
          published or committed until we talk.
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
      </Section>

      <Section className="border-b border-line">
        <AcademyFaq
          heading="Sponsor questions"
          faqs={[
            {
              q: 'What does sponsorship cost?',
              a: 'Rates aren’t published — placements start small and scale with the audience, and every engagement is priced in the first conversation. Nothing is committed until you talk to Shawn.',
            },
            {
              q: 'Where would my business appear?',
              a: 'Across the driver directory: the hub, state pages, interstate corridor pages, individual listing pages, the map sidebar, and the truck parking landing pages. Every sponsored link is clearly labeled and carries rel="sponsored".',
            },
            {
              q: 'How do payments work?',
              a: 'No payment is collected on this site. The inquiry form starts a conversation; terms and invoicing are handled directly with Shawn.',
            },
            {
              q: 'Can I fund a student instead of buying placement?',
              a: 'Yes — community-funded seats are the heart of the mission. The Founders Wall is the direct way to fund training for a driver.',
            },
          ]}
        />
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
            initialInterest={initialInterest}
            context={context}
          />
        </div>
      </Section>
    </>
  );
}
