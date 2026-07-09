import { Section, Button } from '@/components/ui';
import { PageHero, Placeholder, AcademyFaq } from '@/components/academy';
import {
  CampaignThermometer,
  FoundersWallList,
  BecomeFounderForm,
  FOUNDER_TIERS,
} from '@/components/community';
import { getCampaignProgress, getPublicFounders } from '@/lib/community/founders';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'Founders Wall — Help Build the School | Trucking Life Academy',
  description:
    'Back Trucking Life Academy and get your name on the Founders Wall. Community-funded CDL training in Dalton, GA — drivers helping drivers put real people behind the wheel.',
  path: '/founders',
});

/**
 * /founders — the Founders Wall (Milestone 9). Public, ISR-rendered from the
 * existing `founders` table + `campaign_progress` view. Shows the live campaign
 * thermometer, the wall of public founders grouped by tier, the giving tiers,
 * an interest-capture form (no payment processing — that's a later milestone),
 * and an FAQ. No email/SMS is sent.
 */
export const revalidate = 60;

const FAQS = [
  {
    q: 'What is the Founders Wall?',
    a: 'It’s how the community helps build Trucking Life Academy. Founders who back the school get their name — and their business, if they have one — recognized on the wall. The money funds real drivers getting a real shot behind the wheel.',
  },
  {
    q: 'Is my contribution tax-deductible?',
    a: 'That depends on your situation and how the contribution is structured. We’ll confirm the details with you directly — don’t treat anything here as tax advice.',
  },
  {
    q: 'How do I actually pay?',
    a: 'You don’t pay on this page. Tell us you’re interested and Shawn follows up personally to arrange the contribution in whatever way works best for you.',
  },
  {
    q: 'Can my business be listed?',
    a: 'Yes. Business founders can have their name and a link shown on the wall. Paid placements are marked appropriately so everything stays above board.',
  },
];

export default async function FoundersPage() {
  const [progress, founders] = await Promise.all([getCampaignProgress(), getPublicFounders()]);
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

  return (
    <>
      <JsonLd
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Founders Wall', path: '/founders' },
        ])}
      />

      <PageHero
        crumbs={[{ name: 'Home', href: '/' }, { name: 'Founders Wall' }]}
        eyebrow="Founders Wall"
        title="Help build the school,"
        highlight="brick by brick."
        intro="Trucking Life Academy is being built by drivers, for drivers. Every founder who backs it gets their name on the wall — and puts a real person one step closer to a CDL."
      >
        <Button href="#join">Become a founder</Button>
        <Button variant="ghost" href="/academy">
          See the Academy
        </Button>
      </PageHero>

      {/* Live campaign */}
      <Section id="campaign" className="border-b border-line">
        <div className="mx-auto max-w-2xl">
          <CampaignThermometer progress={progress} />
          <p className="mt-4 text-center text-sm text-muted">
            Goal shown is the current build target. Founders are recognized on the wall below.
          </p>
        </div>
      </Section>

      {/* The wall */}
      <Section id="wall" className="border-b border-line bg-asphalt-800">
        <div className="mb-10 max-w-2xl">
          <h2 className="display-section">The founders</h2>
          <p className="mt-4 text-muted">
            The drivers and businesses building this school. Newest founders rise to the top of
            their tier.
          </p>
        </div>
        <FoundersWallList founders={founders} />
      </Section>

      {/* Tiers */}
      <Section id="tiers" className="border-b border-line">
        <div className="mb-10 max-w-2xl">
          <h2 className="display-section">Ways to found the school</h2>
          <p className="mt-4 text-muted">
            Pick the level that fits. Exact contribution amounts are being finalized —{' '}
            <Placeholder>amounts TBD</Placeholder> — so reach out and we’ll walk you through it.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FOUNDER_TIERS.map((t) => (
            <div key={t.value} className="rounded-card border border-line bg-asphalt-800 p-6">
              <h3 className="font-display text-xl text-signal">{t.label}</h3>
              <p className="mt-2 text-sm text-muted">{t.blurb}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* Join */}
      <Section id="join" className="border-b border-line bg-asphalt-800">
        <div className="mx-auto max-w-2xl">
          <div className="mb-8 max-w-2xl">
            <h2 className="display-section">Become a founder</h2>
            <p className="mt-4 text-muted">
              Tell us you’re in and Shawn will reach out personally. No payment is collected here —
              this just starts the conversation.
            </p>
          </div>
          <BecomeFounderForm siteKey={siteKey} />
        </div>
      </Section>

      {/* FAQ */}
      <Section id="faq">
        <div className="mx-auto max-w-2xl">
          <AcademyFaq faqs={FAQS} />
        </div>
      </Section>
    </>
  );
}
