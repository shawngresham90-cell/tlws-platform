import Link from 'next/link';
import { Section, Eyebrow } from '@/components/ui';
import { ClaimForm } from '@/components/preschool/ClaimForm';
import {
  FOUNDING_CLAIM_PATH,
  FOUNDING_STUDENT_CAPACITY,
  PRESCHOOL_PATH,
} from '@/lib/preschool/constants';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 300;

export const metadata = buildMetadata({
  title: 'Claim Your Founding Student Spot — CDL Pre-School | Trucking Life with Shawn',
  description:
    'Bought CDL Pre-School? Submit your chosen public name for the Founding Student Wall. Purchases are verified by hand — your email stays private and nothing publishes automatically.',
  path: FOUNDING_CLAIM_PATH,
});

export default function FoundingClaimPage() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';
  return (
    <>
      <JsonLd
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'CDL Pre-School', path: PRESCHOOL_PATH },
          { name: 'Claim your spot', path: FOUNDING_CLAIM_PATH },
        ])}
      />
      <Section className="border-b border-line">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
          <Link href="/" className="hover:text-signal">
            Home
          </Link>{' '}
          <span aria-hidden="true">›</span>{' '}
          <Link href={PRESCHOOL_PATH} className="hover:text-signal">
            CDL Pre-School
          </Link>{' '}
          <span aria-hidden="true">›</span> <span className="text-ink">Claim your spot</span>
        </nav>
        <Eyebrow>Founding Students</Eyebrow>
        <h1 className="display-section max-w-3xl">Claim your Founding Student spot</h1>
        <p className="mt-4 max-w-2xl text-muted">
          Purchased CDL Pre-School as one of the first {FOUNDING_STUDENT_CAPACITY}? Tell us the
          email you used at Stan Store checkout and the name you want on the wall. We verify every
          purchase by hand — nothing is published automatically, your email is never shown, and
          you can stay anonymous.
        </p>
      </Section>
      <Section className="bg-asphalt-800">
        <div className="mx-auto max-w-xl rounded-card border border-line bg-asphalt p-8">
          <ClaimForm siteKey={siteKey} />
        </div>
      </Section>
    </>
  );
}
