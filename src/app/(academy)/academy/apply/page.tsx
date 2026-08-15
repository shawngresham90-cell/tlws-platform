import { Container } from '@/components/ui';
import { PageHero } from '@/components/academy';
import { ApplyForm } from '@/components/apply';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';
import {
  ACADEMY_ADDRESS,
  TUITION,
  WEEKEND,
  WEEKDAY,
  EQUIPMENT,
  PLACEMENT,
  ENROLL_CTA_LINE,
} from '@/lib/academy/program';

export const metadata = buildMetadata({
  title: 'Apply to the Academy — CDL-A Enrollment | Trucking Life Academy',
  description: `Apply for CDL-A training at Trucking Life Academy, ${ACADEMY_ADDRESS.oneLine}. Tuition ${TUITION}. Weekend classes begin October 2026. A quick two-step form — no payment collected.`,
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
            {/* What you're applying TO, stated immediately above the form.
                An application CTA that doesn't restate price, place and start
                date makes the applicant go hunting — and a school that hides
                its number until the form is the thing this site is against.
                All values read from lib/academy/program. */}
            <div className="mb-8 rounded-card border border-line bg-asphalt-800 p-5 sm:p-6">
              <h2 className="font-display text-lg uppercase text-ink">What you’re applying for</h2>
              <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Tuition
                  </dt>
                  <dd className="mt-1 text-ink">{TUITION} — either program</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                    Location
                  </dt>
                  <dd className="mt-1 text-ink">{ACADEMY_ADDRESS.oneLine}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {WEEKEND.name}
                  </dt>
                  <dd className="mt-1 text-ink">
                    {WEEKEND.startsLabel} · {WEEKEND.meets} · {WEEKEND.length}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                    {WEEKDAY.name}
                  </dt>
                  <dd className="mt-1 text-ink">
                    {WEEKDAY.startsLabel} · {WEEKDAY.length}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-sm text-muted">
                {EQUIPMENT.summary} {PLACEMENT.headline} {PLACEMENT.detail}
              </p>
              <p className="mt-3 text-sm font-semibold text-ink">{ENROLL_CTA_LINE}</p>
            </div>
            <ApplyForm siteKey={siteKey} />
          </div>
        </Container>
      </section>
    </>
  );
}
