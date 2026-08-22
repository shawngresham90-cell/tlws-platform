import { Section, Button } from '@/components/ui';
import { PageHero, AcademyFaq } from '@/components/academy';
import {
  FundedStatusPanel,
  FoundersWallList,
  BecomeFounderForm,
  FOUNDER_TIERS,
  tierAmountLabel,
} from '@/components/community';
import { getPublicFounders } from '@/lib/community/founders';
import { tierRemaining, tierUsage } from '@/lib/community/campaign';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'Founders Wall — School Is Funded | Trucking Life Academy',
  description:
    'The school is funded. Trucking Life Academy was built founder by founder — see the drivers and businesses recognized on the Founders Wall in Dalton, GA.',
  path: '/founders',
});

/**
 * /founders — the Founders Wall (Milestone 9). Public, ISR-rendered from the
 * existing `founders` table. The owner has declared the school funded, so the
 * page shows the SCHOOL IS FUNDED panel (no aggregate money anywhere), the wall
 * of public founders grouped by tier, the recognition tiers, an interest-capture
 * form (no payment processing), and an FAQ. No email/SMS is sent. The campaign
 * thermometer moved to admin-only; `campaign_progress` is no longer read here.
 */
export const revalidate = 60;

const FAQS = [
  {
    q: 'What is the Founders Wall?',
    a: 'It’s how the community built Trucking Life Academy. The school is funded, and the founders who backed it keep their name — and their business, if they have one — recognized on the wall.',
  },
  {
    q: 'What does each tier cost?',
    a: 'Iron Founder is $1,000, Steel Founder is $500, and Brick Founder is $100. Equipment Sponsor and Student Sponsor don’t have a set figure — those are arranged directly, because they depend on the equipment or the student being backed.',
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
    q: 'Is my contribution amount shown on the wall?',
    a: 'No. The wall shows your name, your tier and your business if you have one. What any individual founder gave is never displayed next to their name — only the campaign total is public.',
  },
  {
    q: 'Can my business be listed?',
    a: 'Yes. Business founders can have their name and a link shown on the wall. Paid placements are marked appropriately so everything stays above board.',
  },
];

export default async function FoundersPage() {
  const founders = await getPublicFounders();
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
  const usage = tierUsage(founders);

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
        title="School is funded,"
        highlight="brick by brick."
        intro="Trucking Life Academy was built by drivers, for drivers. Every founder who backed it is recognized on the wall below."
      >
        <Button href="#join">Become a founder</Button>
        <Button variant="ghost" href="/academy">
          See the Academy
        </Button>
      </PageHero>

      {/* Live campaign */}
      <Section id="campaign" className="border-b border-line">
        <div className="mx-auto max-w-2xl">
          <FundedStatusPanel founderCount={founders.length} />
          <p className="mt-4 text-center text-sm text-muted">
            Founders are recognized on the wall below, in founder order within each tier.
          </p>
        </div>
      </Section>

      {/* The wall */}
      <Section id="wall" className="border-b border-line bg-asphalt-800">
        <div className="mb-10 max-w-2xl">
          <h2 className="display-section">The founders</h2>
          <p className="mt-4 text-muted">
            The drivers and businesses who built this school, shown in founder order within each
            tier.
          </p>
        </div>
        <FoundersWallList founders={founders} />
      </Section>

      {/* Tiers */}
      <Section id="tiers" className="border-b border-line">
        <div className="mb-10 max-w-2xl">
          <h2 className="display-section">Ways to found the school</h2>
          <p className="mt-4 text-muted">
            Pick the level that fits. Nothing is collected on this page — tell us which tier you
            want and Shawn follows up personally to arrange it.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FOUNDER_TIERS.map((t) => {
            const open = tierRemaining(t.capacity, usage[t.value]);
            const amount = tierAmountLabel(t);
            return (
              <div key={t.value} className="rounded-card border border-line bg-asphalt-800 p-6">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <h3 className="font-display text-xl text-signal">{t.label}</h3>
                  <p
                    className="font-display text-lg text-ink"
                    // Screen readers get the relationship spelled out; sighted
                    // users get the label and the figure side by side.
                    aria-label={
                      t.amountCents === null
                        ? `${t.label}: contribution amount arranged directly with Shawn`
                        : `${t.label}: ${amount} contribution`
                    }
                  >
                    {amount}
                  </p>
                </div>
                <p className="mt-2 text-sm text-muted">{t.blurb}</p>
                {open !== null && (
                  <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">
                    {open > 0 ? `${open} of ${t.capacity} spots open` : 'Tier full'}
                  </p>
                )}
              </div>
            );
          })}
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
