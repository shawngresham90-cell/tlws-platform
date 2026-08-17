import Link from 'next/link';
import { Section, Button } from '@/components/ui';
import { SectionHeading } from './SectionHeading';
import { FeatureGrid, type Feature } from './FeatureGrid';
import { ACADEMY_ADDRESS, TUITION } from '@/lib/academy/program';

const PILLARS: Feature[] = [
  {
    title: 'ELDT Compliant',
    description:
      'A curriculum built to the FMCSA Entry-Level Driver Training standard — theory plus behind-the-wheel range and road time.',
    // The CTA says "curriculum", so it links the curriculum page — not the
    // hub it duplicated before (SEO blueprint PR-C).
    href: '/academy/curriculum',
    cta: 'See the curriculum',
  },
  {
    title: 'Real Equipment',
    description:
      'Manual 10-speed trucks and a 53-foot trailer. You train on what you’ll actually drive.',
    href: '/academy',
    cta: 'Tour the yard',
  },
  {
    title: 'Driver Instructors',
    description: 'Taught by working drivers, not classroom-only trainers. Road wisdom, not theory.',
    href: '/academy',
    cta: 'Meet the team',
  },
];

export function Academy() {
  return (
    <Section id="academy" className="border-b border-line">
      <SectionHeading
        eyebrow="The Academy"
        title="CDL-A training that respects your time"
        intro="Trucking Life Academy trains working drivers and career-changers in Dalton, GA. Built to reach the people corporate schools price out or pass over."
      />
      <FeatureGrid features={PILLARS} />
      {/* The facts a prospective student actually needs before clicking:
          price, where, and when. Read from lib/academy/program so the homepage
          can never quote a stale figure — which is exactly what the old
          "Full 160-hour curriculum" line was doing. */}
      <p className="mt-8 max-w-2xl text-muted">
        <strong className="text-ink">Tuition {TUITION}</strong> ·{' '}
        <Link href="/academy/financing" className="text-signal underline-offset-4 hover:underline">
          Financing options →
        </Link>{' '}
        · {ACADEMY_ADDRESS.oneLine} · Weekend classes begin October 2026, Saturdays and Sundays for
        eight weekends. A weekday program of approximately three to four weeks begins January 2027.
      </p>
      <div className="mt-9">
        <Button href="/academy/apply">Apply to the Academy</Button>
      </div>
    </Section>
  );
}
