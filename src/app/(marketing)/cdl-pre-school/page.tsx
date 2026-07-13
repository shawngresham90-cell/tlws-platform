import Link from 'next/link';
import { Section, Eyebrow, Button } from '@/components/ui';
import { PurchaseCta } from '@/components/preschool/PurchaseCta';
import { PageViewEvent } from '@/components/preschool/PageViewEvent';
import { CurriculumDisclosure } from '@/components/preschool/CurriculumDisclosure';
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
  CURRICULUM_CONFIRMED,
  CURRICULUM_PLACEHOLDER,
  FAQS,
  PROBLEMS,
  PRESCHOOL_TAGLINE,
  VERIFIED_BENEFITS,
  WHAT_IT_IS_NOT,
  WHO_ITS_FOR,
} from '@/lib/preschool/content';
import { preschoolCourseSchema } from '@/lib/preschool/preschool-schema';
import { JsonLd, breadcrumbSchema, faqSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 300;

export const metadata = buildMetadata({
  title: 'CDL Pre-School — Prepare Before CDL School | Trucking Life with Shawn',
  description: `Online CDL school preparation from a 17-year driver: permit knowledge, money and family planning, and what to know before CDL school. Founding Student price ${PRESCHOOL_PRICE_LABEL} — first ${FOUNDING_STUDENT_CAPACITY} verified students.`,
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
          {wall.filled > 0 ? ` — ${wall.remaining} of ${FOUNDING_STUDENT_CAPACITY} spots remaining` : ''}
        </p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
          <PurchaseCta placement="hero">Become a Founding Student — {PRESCHOOL_PRICE_LABEL}</PurchaseCta>
          <Button variant="ghost" href="#whats-included">
            See what&apos;s included
          </Button>
        </div>
        <Disclosure />
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
          {VERIFIED_BENEFITS.map((b) => (
            <li key={b} className="flex items-start gap-3 text-ink">
              <span aria-hidden="true" className="mt-0.5 text-signal">
                ✓
              </span>
              {b}
            </li>
          ))}
          <li className="flex items-start gap-3 text-ink">
            <span aria-hidden="true" className="mt-0.5 text-signal">
              ✓
            </span>
            Workbooks included with the course
          </li>
        </ul>
      </Section>

      {/* 4 · Curriculum */}
      <Section className="border-b border-line bg-asphalt-800">
        <Eyebrow>Inside the course</Eyebrow>
        <h2 className="display-section max-w-3xl">What CDL Pre-School covers</h2>
        <div className="mt-8 max-w-3xl space-y-3">
          <CurriculumDisclosure summary="Permit & classroom knowledge">
            The knowledge areas the permit exam and the first classroom weeks are built on,
            explained the way drivers talk.
          </CurriculumDisclosure>
          <CurriculumDisclosure summary="Money, family & lifestyle preparation">
            Planning the training weeks, preparing your family, and understanding what the trucking
            life actually asks — before you commit.
          </CurriculumDisclosure>
          <CurriculumDisclosure summary="Choosing your CDL school & career path">
            How to compare schools and programs — contract schools, mega-carrier training,
            independent academies — and pick the path that fits your life.
          </CurriculumDisclosure>
        </div>
        {!CURRICULUM_CONFIRMED && (
          <div className="mt-6 max-w-3xl rounded-card border border-signal/50 bg-signal/10 px-4 py-3 text-sm text-signal">
            <strong className="font-semibold">{CURRICULUM_PLACEHOLDER.heading}.</strong>{' '}
            <span className="text-ink">{CURRICULUM_PLACEHOLDER.body}</span>
          </div>
        )}
      </Section>

      {/* 5 · Who it's for */}
      <Section className="border-b border-line">
        <Eyebrow>Who it&apos;s for</Eyebrow>
        <h2 className="display-section max-w-3xl">Made for the people trucking hasn&apos;t met yet</h2>
        <ul className="mt-8 grid max-w-3xl gap-4 sm:grid-cols-2">
          {WHO_ITS_FOR.map((w) => (
            <li key={w} className="rounded-card border border-line bg-asphalt-800 p-5 text-sm text-ink">
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
              <span aria-hidden="true" className="mt-0.5 text-diesel">
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
            <p className="mt-2 text-sm text-ink">The founding price for full access to CDL Pre-School.</p>
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
              <Link href={FOUNDING_WALL_PATH} className="text-signal underline-offset-4 hover:underline">
                Founding Student Wall
              </Link>
              {' '}— or stay anonymous. Your call.
            </p>
          </div>
        </div>
        <div className="mt-8">
          <PurchaseCta placement="offer">Claim a Founding Student spot — {PRESCHOOL_PRICE_LABEL}</PurchaseCta>
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
          — ELDT-compliant CDL-A training in Dalton, GA — is the destination.
        </p>
      </Section>

      {/* 9 · FAQs */}
      <Section className="border-b border-line">
        <Eyebrow>Questions, answered straight</Eyebrow>
        <h2 className="display-section max-w-3xl">CDL Pre-School FAQ</h2>
        <div className="mt-8 max-w-3xl space-y-6">
          {FAQS.map((f) => (
            <div key={f.question}>
              <h3 className="font-display text-lg uppercase text-ink">{f.question}</h3>
              <p className="mt-2 text-sm text-muted">{f.answer}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* 10 · Final CTA */}
      <Section className="bg-asphalt-800">
        <div className="mx-auto max-w-2xl text-center">
          <Eyebrow>Ready when you are</Eyebrow>
          <h2 className="display-section">
            Start CDL Pre-School — {PRESCHOOL_PRICE_LABEL}
          </h2>
          <p className="mt-4 text-muted">
            Limited to the first {FOUNDING_STUDENT_CAPACITY} verified Founding Students. No fake
            timers, no fake counters — when the wall is full, the founding offer is gone.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3">
            <PurchaseCta placement="final">Become a Founding Student — {PRESCHOOL_PRICE_LABEL}</PurchaseCta>
            <p className="max-w-md text-xs text-muted">{CHECKOUT_DISCLOSURE}</p>
            <Link
              href={FOUNDING_WALL_PATH}
              className="text-sm text-signal underline-offset-4 hover:underline"
            >
              See the Founding Student Wall →
            </Link>
          </div>
        </div>
      </Section>
    </>
  );
}
