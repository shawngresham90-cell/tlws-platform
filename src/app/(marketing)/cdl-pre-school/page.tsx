import Link from 'next/link';
import { Section, Eyebrow, Button } from '@/components/ui';
import { PurchaseCta } from '@/components/preschool/PurchaseCta';
import { PageViewEvent } from '@/components/preschool/PageViewEvent';
import { CurriculumDisclosure } from '@/components/preschool/CurriculumDisclosure';
import { SpotsMeter } from '@/components/preschool/SpotsMeter';
import { TrustBadges } from '@/components/preschool/TrustBadges';
import { StickyCta } from '@/components/preschool/StickyCta';
import { ScrollDepth } from '@/components/preschool/ScrollDepth';
import { FaqItem } from '@/components/preschool/FaqItem';
import { TrackedNavLink } from '@/components/preschool/TrackedNavLink';
import { getFoundingWall } from '@/lib/preschool/data';
import {
  CHECKOUT_DISCLOSURE,
  FOUNDING_STUDENT_CAPACITY,
  FOUNDING_WALL_PATH,
  PRESCHOOL_PATH,
  PRESCHOOL_PRICE_LABEL,
} from '@/lib/preschool/constants';
import {
  CREDIBILITY,
  CURRICULUM_GROUPS,
  FAQS,
  LESSON_COUNT,
  MODULE_COUNT,
  PROBLEMS,
  PRESCHOOL_TAGLINE,
  WHAT_IT_IS_NOT,
  WHO_ITS_FOR,
  WHATS_INCLUDED,
} from '@/lib/preschool/content';
import { preschoolCourseSchema } from '@/lib/preschool/preschool-schema';
import { JsonLd, breadcrumbSchema, faqSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 300;

export const metadata = buildMetadata({
  title: 'CDL Pre-School — Prepare Before CDL School | Trucking Life with Shawn',
  description: `Online CDL school preparation from a 17-year driver: ${MODULE_COUNT} modules and ${LESSON_COUNT} self-paced lessons on permit knowledge, choosing a school, and life on the road. Founding Student price ${PRESCHOOL_PRICE_LABEL} — first ${FOUNDING_STUDENT_CAPACITY} verified students.`,
  path: PRESCHOOL_PATH,
});

/** One shared line under every purchase button — external checkout, plainly disclosed. */
function Disclosure() {
  return <p className="mt-3 max-w-md text-xs text-muted">{CHECKOUT_DISCLOSURE}</p>;
}

export default async function PreSchoolPage() {
  const wall = await getFoundingWall();

  return (
    <>
      <PageViewEvent />
      <ScrollDepth />
      <StickyCta />
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'CDL Pre-School', path: PRESCHOOL_PATH },
          ]),
          preschoolCourseSchema(),
          ...(function () {
            const s = faqSchema(FAQS.map((f) => ({ question: f.question, answer: f.answer })));
            return s ? [s] : [];
          })(),
        ]}
      />

      {/* 1 · Hero */}
      <Section className="border-b border-line">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
          <Link href="/" className="hover:text-signal">
            Home
          </Link>{' '}
          <span aria-hidden="true">›</span> <span className="text-ink">CDL Pre-School</span>
        </nav>
        <Eyebrow>Founding Student — {PRESCHOOL_PRICE_LABEL} · Online · Before CDL school</Eyebrow>
        <h1 className="display-hero max-w-4xl">
          CDL Pre-School<span className="text-signal">.</span> Show up to CDL school{' '}
          <span className="text-signal">already ahead.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">{PRESCHOOL_TAGLINE}</p>
        <p className="mt-4 max-w-2xl text-sm font-semibold uppercase tracking-wide text-signal">
          Limited to the first {FOUNDING_STUDENT_CAPACITY} verified Founding Students
        </p>
        <div className="mt-4">
          <SpotsMeter filled={wall.filled} remaining={wall.remaining} />
        </div>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <PurchaseCta placement="hero">
            Become a Founding Student — {PRESCHOOL_PRICE_LABEL}
          </PurchaseCta>
          <Button variant="ghost" href="#whats-included">
            See what&apos;s included
          </Button>
        </div>
        <Disclosure />
        <TrustBadges className="mt-6" />
      </Section>

      {/* 2 · Problem */}
      <Section className="border-b border-line bg-asphalt-800">
        <Eyebrow>The problem</Eyebrow>
        <h2 className="display-section max-w-3xl">
          Most students walk into CDL school unprepared — and pay for it
        </h2>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {PROBLEMS.map((p) => (
            <div key={p.title} className="rounded-card border border-line bg-asphalt p-6">
              <h3 className="font-display text-lg uppercase text-ink">{p.title}</h3>
              <p className="mt-2 text-sm text-muted">{p.body}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 3 · What the program provides */}
      <Section id="whats-included" className="border-b border-line">
        <Eyebrow>What you get</Eyebrow>
        <h2 className="display-section max-w-3xl">Permit prep the driver way</h2>
        <p className="mt-4 max-w-2xl text-muted">
          Built and taught by a CDL instructor — what the test actually asks, without the textbook
          fog, plus the real-life preparation classrooms skip.
        </p>
        <ul className="mt-8 grid max-w-3xl gap-4">
          {WHATS_INCLUDED.map((b) => (
            <li key={b} className="flex items-start gap-3 text-ink">
              <span aria-hidden="true" className="mt-0.5 text-signal">
                ✓
              </span>
              {b}
            </li>
          ))}
        </ul>
      </Section>

      {/* 4 · Curriculum — the real 7 modules / 33 lessons */}
      <Section className="border-b border-line bg-asphalt-800">
        <Eyebrow>Inside the course</Eyebrow>
        <h2 className="display-section max-w-3xl">
          {MODULE_COUNT} modules. {LESSON_COUNT} lessons. In the right order.
        </h2>
        <p className="mt-4 max-w-2xl text-muted">
          Modules unlock one at a time — pass each module&apos;s quiz to open the next, the same way
          a good school builds you up.
        </p>
        <div className="mt-8 max-w-3xl space-y-8">
          {CURRICULUM_GROUPS.map((group) => (
            <div key={group.heading}>
              <h3 className="mb-3 font-display text-xl uppercase text-signal">{group.heading}</h3>
              <div className="space-y-3">
                {group.modules.map((m) => (
                  <CurriculumDisclosure key={m.number} summary={`Module ${m.number} — ${m.title}`}>
                    {m.summary} ({m.lessons} lessons, each with a workbook.)
                  </CurriculumDisclosure>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-10">
          <PurchaseCta placement="after-curriculum">
            Start CDL Pre-School — {PRESCHOOL_PRICE_LABEL}
          </PurchaseCta>
          <Disclosure />
        </div>
      </Section>

      {/* 5 · Who it's for */}
      <Section className="border-b border-line">
        <Eyebrow>Who it&apos;s for</Eyebrow>
        <h2 className="display-section max-w-3xl">
          Made for the people trucking hasn&apos;t met yet
        </h2>
        <ul className="mt-8 grid max-w-3xl gap-4 sm:grid-cols-2">
          {WHO_ITS_FOR.map((w) => (
            <li
              key={w}
              className="rounded-card border border-line bg-asphalt-800 p-5 text-sm text-ink"
            >
              {w}
            </li>
          ))}
        </ul>
      </Section>

      {/* 6 · What it is not */}
      <Section className="border-b border-line bg-asphalt-800">
        <Eyebrow>Straight talk</Eyebrow>
        <h2 className="display-section max-w-3xl">What CDL Pre-School is not</h2>
        <p className="mt-4 max-w-2xl text-muted">
          Honesty is the whole brand. Know exactly what you&apos;re buying:
        </p>
        <ul className="mt-8 max-w-3xl space-y-3">
          {WHAT_IT_IS_NOT.map((n) => (
            <li key={n} className="flex items-start gap-3 text-ink">
              <span aria-hidden="true" className="mt-0.5 text-diesel-300">
                ✕
              </span>
              {n}
            </li>
          ))}
        </ul>
      </Section>

      {/* 7 · Founding Student offer */}
      <Section className="border-b border-line">
        <Eyebrow>The Founding Student offer</Eyebrow>
        <h2 className="display-section max-w-3xl">
          {PRESCHOOL_PRICE_LABEL} — and your name on the wall, permanently
        </h2>
        <div className="mt-8 grid max-w-4xl gap-6 sm:grid-cols-3">
          <div className="rounded-card border border-signal bg-signal/10 p-6">
            <p className="font-display text-3xl uppercase text-signal">{PRESCHOOL_PRICE_LABEL}</p>
            <p className="mt-2 text-sm text-ink">
              The founding price for full access to CDL Pre-School.
            </p>
          </div>
          <div className="rounded-card border border-line bg-asphalt-800 p-6">
            <p className="font-display text-3xl uppercase text-ink">{FOUNDING_STUDENT_CAPACITY}</p>
            <p className="mt-2 text-sm text-muted">
              Verified Founding Student spots. When they&apos;re filled, the founding offer closes.
            </p>
          </div>
          <div className="rounded-card border border-line bg-asphalt-800 p-6">
            <p className="font-display text-3xl uppercase text-ink">The Wall</p>
            <p className="mt-2 text-sm text-muted">
              Your chosen public name on the{' '}
              <TrackedNavLink
                href={FOUNDING_WALL_PATH}
                placement="offer"
                className="text-signal underline-offset-4 hover:underline"
              >
                Founding Student Wall
              </TrackedNavLink>{' '}
              — or stay anonymous. Your call.
            </p>
          </div>
        </div>
        <div className="mt-6">
          <SpotsMeter filled={wall.filled} remaining={wall.remaining} />
        </div>
        <div className="mt-8">
          <PurchaseCta placement="offer">
            Claim a Founding Student spot — {PRESCHOOL_PRICE_LABEL}
          </PurchaseCta>
          <Disclosure />
        </div>
      </Section>

      {/* 8 · Founder credibility */}
      <Section className="border-b border-line bg-asphalt-800">
        <Eyebrow>Who&apos;s teaching</Eyebrow>
        <h2 className="display-section max-w-3xl">{CREDIBILITY.heading}</h2>
        <ul className="mt-8 max-w-3xl space-y-3">
          {CREDIBILITY.points.map((p) => (
            <li key={p} className="flex items-start gap-3 text-ink">
              <span aria-hidden="true" className="mt-0.5 text-signal">
                ✓
              </span>
              {p}
            </li>
          ))}
        </ul>
        <p className="mt-6 max-w-2xl text-sm text-muted">
          CDL Pre-School is the on-ramp.{' '}
          <Link href="/academy" className="text-signal underline-offset-4 hover:underline">
            Trucking Life Academy
          </Link>{' '}
          — ELDT-compliant CDL-A training in Dalton, GA — is the destination. When you&apos;re ready
          to kit out the cab, the{' '}
          <Link href="/store" className="text-signal underline-offset-4 hover:underline">
            Trucking Life Store
          </Link>{' '}
          has the road-tested gear.
        </p>
      </Section>

      {/* 9 · FAQs */}
      <Section className="border-b border-line">
        <Eyebrow>Questions, answered straight</Eyebrow>
        <h2 className="display-section max-w-3xl">CDL Pre-School FAQ</h2>
        <div className="mt-8 max-w-3xl space-y-3">
          {FAQS.map((f) => (
            <FaqItem key={f.question} question={f.question} answer={f.answer} />
          ))}
        </div>
      </Section>

      {/* 10 · Final CTA */}
      <Section className="bg-asphalt-800">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Ready when you are</Eyebrow>
          <h2 className="display-section">Start CDL Pre-School — {PRESCHOOL_PRICE_LABEL}</h2>
          <p className="mt-4 text-muted">
            Limited to the first {FOUNDING_STUDENT_CAPACITY} verified Founding Students. No fake
            timers, no fake counters — when the wall is full, the founding offer is gone.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <SpotsMeter filled={wall.filled} remaining={wall.remaining} />
            <PurchaseCta placement="final">
              Become a Founding Student — {PRESCHOOL_PRICE_LABEL}
            </PurchaseCta>
            <p className="max-w-md text-xs text-muted">{CHECKOUT_DISCLOSURE}</p>
            <TrackedNavLink
              href={FOUNDING_WALL_PATH}
              placement="final"
              className="text-sm text-signal underline-offset-4 hover:underline"
            >
              See the Founding Student Wall →
            </TrackedNavLink>
          </div>
        </div>
      </Section>
      {/* Reserve room so the mobile sticky CTA never covers the last content. */}
      <div aria-hidden="true" className="h-24 sm:hidden" />
    </>
  );
}
