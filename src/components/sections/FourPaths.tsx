import Link from 'next/link';
import { Section, Eyebrow, Button } from '@/components/ui';
import { PurchaseCta } from '@/components/preschool/PurchaseCta';
import { SpotsMeter } from '@/components/preschool/SpotsMeter';
import { TrackedNavLink } from '@/components/preschool/TrackedNavLink';
import { getFoundingWall } from '@/lib/preschool/data';
import {
  FOUNDING_STUDENT_CAPACITY,
  PRESCHOOL_PATH,
  PRESCHOOL_PRICE_LABEL,
} from '@/lib/preschool/constants';

/**
 * The Four Doors (blueprint §4 S3) — the routing layer. One placard per
 * audience; exactly two carry the amber money edge (the school door and the
 * mission door). The CDL door keeps the live Pre-School purchase machinery —
 * capacity copy states the real 20-spot limit and nothing else, house rule.
 */
const FREE_DOORS: Array<{
  title: string;
  description: string;
  links: Array<{ label: string; href: string }>;
}> = [
  {
    title: 'I drive and want free tools',
    description:
      'The truck-stop directory, guaranteed parking, and a truck-legal trip planner — built for working drivers, free.',
    links: [
      { label: 'Open the Directory', href: '/directory' },
      { label: 'Plan a trip', href: '/trip-planner' },
    ],
  },
  {
    title: 'I want to learn the regs',
    description:
      'Plain-English DOT guides verified against the eCFR, and free practice tests with the citation on every question.',
    links: [
      { label: 'Knowledge Center', href: '/knowledge' },
      { label: 'Practice tests', href: '/practice-tests' },
    ],
  },
];

export async function FourPaths() {
  const wall = await getFoundingWall();
  return (
    <Section id="paths" className="border-b border-line bg-asphalt-800">
      <Eyebrow>Pick your lane</Eyebrow>
      <h2 className="display-section max-w-3xl">Four ways to start</h2>
      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        {/* Door 1 — I want my CDL (money path: school + Pre-School) */}
        <div className="placard placard-money lift flex flex-col p-4 sm:p-6 lg:row-span-2">
          <h3 className="font-display text-2xl uppercase text-ink">I want my CDL</h3>
          <p className="mt-3 text-sm text-muted">
            ELDT-compliant CDL-A training on real trucks in Dalton, GA — applying is free and
            collects no payment.
          </p>
          <div className="mt-5">
            <Button href="/academy/apply">Apply to the Academy</Button>
          </div>

          <div className="mt-6 border-t border-line pt-5">
            <span className="self-start rounded-card bg-signal px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-asphalt">
              Head start — {PRESCHOOL_PRICE_LABEL}
            </span>
            <h4 className="mt-3 font-display text-xl uppercase text-ink">CDL Pre-School</h4>
            <p className="mt-2 flex-1 text-sm text-muted">
              Prepare before CDL school. Learn the knowledge, expectations, and real-life
              preparation new drivers need before training begins.
            </p>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
              Limited to the first {FOUNDING_STUDENT_CAPACITY} verified Founding Students
            </p>
            <div className="mt-2">
              <SpotsMeter filled={wall.filled} remaining={wall.remaining} compact />
            </div>
            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              <PurchaseCta placement="homepage-card" className="px-5 py-2.5 text-base">
                Start CDL Pre-School
              </PurchaseCta>
              <TrackedNavLink
                href={PRESCHOOL_PATH}
                placement="homepage-card"
                className="inline-flex items-center justify-center rounded-card border border-line px-5 py-2.5 font-display text-base uppercase tracking-wide text-ink transition-colors hover:border-signal hover:text-signal"
              >
                See what&apos;s included
              </TrackedNavLink>
            </div>
          </div>
        </div>

        {/* Doors 2–3 — free value, no amber */}
        {FREE_DOORS.map((d) => (
          <div key={d.title} className="placard lift flex flex-col p-4 sm:p-6">
            <h3 className="font-display text-xl uppercase text-ink">{d.title}</h3>
            <p className="mt-2 flex-1 text-sm text-muted">{d.description}</p>
            <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
              {d.links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="font-semibold text-signal underline-offset-4 hover:underline"
                >
                  {l.label} →
                </Link>
              ))}
            </p>
          </div>
        ))}

        {/* Door 4 — back the mission (money path) */}
        <div className="placard placard-money lift flex flex-col p-4 sm:p-6">
          <h3 className="font-display text-xl uppercase text-ink">I want to back the mission</h3>
          <p className="mt-2 flex-1 text-sm text-muted">
            Fund the school as a founder and put your name on the wall — or take the full drive
            through where this is all going.
          </p>
          <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            <Link
              href="/founders"
              className="font-semibold text-signal underline-offset-4 hover:underline"
            >
              Become a founder →
            </Link>
            <Link
              href="/road-ahead"
              className="font-semibold text-signal underline-offset-4 hover:underline"
            >
              See The Road Ahead →
            </Link>
          </p>
        </div>
      </div>
    </Section>
  );
}
