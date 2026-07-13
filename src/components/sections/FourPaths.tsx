import Link from 'next/link';
import { Section, Eyebrow } from '@/components/ui';
import { PurchaseCta } from '@/components/preschool/PurchaseCta';
import {
  FOUNDING_STUDENT_CAPACITY,
  PRESCHOOL_PATH,
  PRESCHOOL_PRICE_LABEL,
} from '@/lib/preschool/constants';

/**
 * The four ways into Trucking Life, right under the hero: CDL Pre-School
 * (featured — the new offering), Apply, Fund, Free Resources. The Pre-School
 * card is the only one with a purchase CTA; capacity copy states the real
 * 20-spot limit and nothing else (no timers, no fake counters — house rule).
 */
const PATHS = [
  {
    title: 'Apply to the Academy',
    description: 'ELDT-compliant CDL-A training on real trucks in Dalton, GA.',
    href: '/academy',
    cta: 'Apply now',
  },
  {
    title: 'Fund the School',
    description: 'Back the school as a founder and put your name on the wall.',
    href: '/founders',
    cta: 'See the Founders Wall',
  },
  {
    title: 'Free CDL Resources',
    description: 'The Knowledge Center — guides and answers, free forever.',
    href: '/knowledge',
    cta: 'Start reading',
  },
] as const;

export function FourPaths() {
  return (
    <Section id="paths" className="border-b border-line bg-asphalt-800">
      <Eyebrow>Pick your lane</Eyebrow>
      <h2 className="display-section max-w-3xl">Four ways to start</h2>
      <div className="mt-10 grid gap-6 lg:grid-cols-2">
        {/* CDL Pre-School — featured card */}
        <div className="flex flex-col rounded-card border-2 border-signal bg-asphalt p-6 lg:row-span-2">
          <span className="self-start rounded-card bg-signal px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-asphalt">
            Founding Student — {PRESCHOOL_PRICE_LABEL}
          </span>
          <h3 className="mt-4 font-display text-2xl uppercase text-ink">CDL Pre-School</h3>
          <p className="mt-3 flex-1 text-sm text-muted">
            Prepare before CDL school. Learn the knowledge, expectations, and real-life
            preparation new drivers need before training begins.
          </p>
          <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-signal">
            Limited to the first {FOUNDING_STUDENT_CAPACITY} verified Founding Students
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <PurchaseCta placement="homepage-card" className="px-5 py-2.5 text-base">
              Start CDL Pre-School
            </PurchaseCta>
            <Link
              href={PRESCHOOL_PATH}
              className="inline-flex items-center justify-center rounded-card border border-line px-5 py-2.5 font-display text-base uppercase tracking-wide text-ink transition-colors hover:border-signal hover:text-signal"
            >
              See what&apos;s included
            </Link>
          </div>
        </div>

        {PATHS.map((p) => (
          <div key={p.href} className="flex flex-col rounded-card border border-line bg-asphalt p-6">
            <h3 className="font-display text-xl uppercase text-ink">{p.title}</h3>
            <p className="mt-2 flex-1 text-sm text-muted">{p.description}</p>
            <p className="mt-4">
              <Link
                href={p.href}
                className="font-semibold text-signal underline-offset-4 hover:underline"
              >
                {p.cta} →
              </Link>
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}
