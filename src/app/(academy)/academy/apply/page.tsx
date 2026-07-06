import { Container } from '@/components/ui';
import { PageHero } from '@/components/academy';
import { ApplyForm } from '@/components/apply';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

export const metadata = buildMetadata({
  title: 'Apply to the Academy — CDL-A Enrollment | Trucking Life Academy',
  description:
    'Start your CDL-A application at Trucking Life Academy in Dalton, GA. A quick two-step form — tell us about you and your goals, and a driver-first team member will reach out. No payment collected.',
  path: '/academy/apply',
});

/**
 * /academy/apply — the Student Application System entry point (Milestone 8).
 * Reads the public Turnstile site key (NEXT_PUBLIC_*, so it's inlined into the
 * client bundle at build time) and hands it to the client form. The form posts
 * to the existing guarded API routes /api/application/step1 and
 * /api/application/step2, which verify the token with TURNSTILE_SECRET_KEY.
 */
export default function ApplyPage() {
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? '';

  return (
    <>
      <JsonLd
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'Academy', path: '/academy' },
          { name: 'Apply', path: '/academy/apply' },
        ])}
      />

      <PageHero
        crumbs={[
          { name: 'Home', href: '/' },
          { name: 'Academy', href: '/academy' },
          { name: 'Apply' },
        ]}
        eyebrow="Apply · CDL-A Enrollment"
        title="Start your"
        highlight="application."
        intro="Two quick steps. Tell us who you are and where you’re headed — a driver-first team member follows up personally. No payment is collected here."
      />

      <section className="py-12 sm:py-16">
        <Container>
          <div className="mx-auto max-w-2xl">
            <ApplyForm siteKey={siteKey} />
          </div>
        </Container>
      </section>
    </>
  );
}
