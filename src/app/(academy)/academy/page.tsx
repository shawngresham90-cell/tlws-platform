import Link from 'next/link';
import { Section, Button, Eyebrow } from '@/components/ui';
import { CampaignThermometer } from '@/components/community/CampaignThermometer';
import { getCampaignProgress } from '@/lib/community/founders';
import { PageHero, CardGrid, AcademyFaq, CtaBand, type Card } from '@/components/academy';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { courseSchema } from '@/lib/seo/academy-schema';
import { buildMetadata } from '@/lib/seo/metadata';
import type { KcFaq } from '@/lib/kc/types';

export const metadata = buildMetadata({
  title: 'Trucking Life Academy — CDL-A Training in Dalton, GA',
  description:
    'ELDT-compliant CDL-A training built by a 17-year driver with zero violations. Real equipment, driver-first instruction, in Dalton, GA off I-75. Drivers helping drivers.',
  path: '/academy',
});

const PILLARS: Card[] = [
  {
    icon: '📋',
    title: 'ELDT Compliant',
    description:
      'Training that meets the FMCSA Entry-Level Driver Training standard — the theory and behind-the-wheel hours you need to test for a Class A CDL.',
    href: '/academy/curriculum',
    cta: 'See the curriculum',
  },
  {
    icon: '🚛',
    title: 'Real Equipment',
    description:
      'You train on a real tractor and 53-foot trailer — the truck you’ll actually drive, not a simulator or a whiteboard.',
    href: '/academy/facility',
    cta: 'Tour the facility',
  },
  {
    icon: '🧭',
    title: 'Driver Instructors',
    description:
      'Taught by working drivers who’ve run the miles. Road wisdom and real accountability, not classroom-only theory.',
    href: '/academy/instructors',
    cta: 'Meet the team',
  },
  {
    icon: '✅',
    title: 'Requirements, Clear',
    description:
      'Age, license, DOT medical, and the CLP — laid out plainly so you know exactly what it takes to start.',
    href: '/academy/requirements',
    cta: 'Check requirements',
  },
  {
    icon: '💵',
    title: 'Funding Options',
    description:
      'Workforce grants, VA benefits, employer sponsorship, and community-funded seats — ways to pay for training without a payday-loan trap.',
    href: '/academy/financing',
    cta: 'Explore financing',
  },
  {
    icon: '📍',
    title: 'Dalton, GA · I-75',
    description:
      'Right on the I-75 corridor in North Georgia — convenient to Whitfield County, Calhoun, Chatsworth, Ringgold, and Chattanooga.',
    href: '/academy/cdl-school-dalton-ga',
    cta: 'Why Dalton',
  },
];

const FAQS: KcFaq[] = [
  {
    q: 'What is Trucking Life Academy?',
    a: 'A CDL-A driver-training school in Dalton, Georgia, founded by Shawn Gresham — a 17-year driver with zero violations who trains new drivers on real equipment. The mission is simple: drivers helping drivers.',
  },
  {
    q: 'Is the training ELDT compliant?',
    a: 'Yes. The program is built around the FMCSA Entry-Level Driver Training (ELDT) standard, covering the required theory and behind-the-wheel instruction you need to test for a Class A CDL.',
  },
  {
    q: 'Do I need any experience to start?',
    a: 'No commercial experience is required. You do need to meet basic eligibility — age, a valid driver’s license, a DOT medical card, and a commercial learner’s permit (CLP). See the Requirements page for the full checklist.',
  },
  {
    q: 'How much does it cost?',
    a: 'Exact tuition is being finalized and will be published soon. In the meantime, the Financing page explains the funding routes drivers can use — workforce grants, VA benefits, employer sponsorship, and community-funded seats.',
  },
  {
    q: 'How old do I have to be?',
    a: 'At least 21 for interstate driving, or 18 if you’ll drive intrastate within Georgia. Not sure which applies to you? Apply anyway and say so — we’ll walk you through it.',
  },
  {
    q: 'Do I need a DOT medical card?',
    a: 'Yes — a DOT medical certificate is a federal requirement for a CDL. Not having one yet doesn’t block your application; the Knowledge Center explains the exam, and we’ll point you to the next step.',
  },
  {
    q: 'What if my driving record isn’t perfect?',
    a: 'A ticket or an old mistake doesn’t automatically end the conversation. Eligibility depends on the specifics — tell us honestly in your application and we’ll talk it through straight. No judgment, no runaround.',
  },
  {
    q: 'What happens if I fail a test?',
    a: 'The program’s whole job is to have you ready before test day — that’s what the phased training and free practice tests are for. Exact retest logistics will be published with the final enrollment details.',
  },
  {
    q: 'Will you help me find a job after?',
    a: 'We won’t promise placement numbers we haven’t earned yet. What you get is honest career preparation — the Knowledge Center’s career-path guides and straight talk about what the first year really looks like.',
  },
  {
    q: 'Where is the school located?',
    a: 'In Dalton, Georgia, right off the I-75 corridor — convenient to North Georgia and the Chattanooga, TN area.',
  },
];

/**
 * The program journey — free preparation to career-ready, using the real
 * curriculum phase names (source of truth: /academy/curriculum). Honest by
 * construction: no hours, dates, or placement claims that aren't published.
 */
const JOURNEY: Array<{ step: string; title: string; description: string; href: string }> = [
  {
    step: 'Before day one',
    title: 'Prepare',
    description:
      'Free Knowledge Center guides and practice tests — or the full CDL Pre-School head start.',
    href: '/cdl-pre-school',
  },
  {
    step: 'Phase 1',
    title: 'Theory & Permit Prep',
    description: 'ELDT theory curriculum: pass the CDL knowledge tests and earn your CLP.',
    href: '/academy/curriculum',
  },
  {
    step: 'Phase 2',
    title: 'Range Skills',
    description: 'Pre-trip inspection, backing, docking, and coupling — on real equipment.',
    href: '/academy/curriculum',
  },
  {
    step: 'Phase 3',
    title: 'Public Road Driving',
    description: 'Real roads and real traffic, taught from 17 years of clean-record experience.',
    href: '/academy/curriculum',
  },
  {
    step: 'Phase 4',
    title: 'Test Prep & Endorsements',
    description: 'Polish for the CDL-A skills test, plus the endorsements worth adding.',
    href: '/academy/curriculum',
  },
  {
    step: 'After the CDL',
    title: 'Career Preparation',
    description: 'Straight talk on first-year jobs and career paths — guidance, not promises.',
    href: '/knowledge/trucking-careers',
  },
];

/** Enrollment transparency — every unpublished detail stated honestly. */
const ENROLLMENT_STATUS: Array<{ label: string; value: string; note: string }> = [
  {
    label: 'Program standard',
    value: 'FMCSA ELDT-compliant CDL-A curriculum',
    note: 'Theory + behind-the-wheel, published phase by phase on the Curriculum page.',
  },
  {
    label: 'Tuition',
    value: 'Being finalized',
    note: 'Published here the moment it’s locked. Financing routes are already documented.',
  },
  {
    label: 'Schedule & start dates',
    value: 'Being finalized',
    note: 'Join the interest list below — applicants hear first.',
  },
  {
    label: 'State licensing',
    value: 'Details published when finalized',
    note: 'We publish our own licensing checklist — ask any school to show you theirs.',
  },
];

export default async function AcademyPage() {
  const campaign = await getCampaignProgress();
  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Academy', path: '/academy' },
          ]),
          courseSchema(),
        ]}
      />

      <PageHero
        crumbs={[{ name: 'Home', href: '/' }, { name: 'Academy' }]}
        eyebrow="Trucking Life Academy · Dalton, GA · off I-75"
        title="The CDL-A school built by a driver,"
        highlight="for drivers."
        intro="Corporate mills push bodies through a system. Trucking Life Academy trains drivers — ELDT-compliant CDL-A instruction on real trucks, real roads, and real accountability, from a man who’s run 17 years with a clean record."
      >
        <Button href="/academy/apply">Apply to the Academy</Button>
        <Button variant="secondary" href="/founders">
          Fund the School
        </Button>
        <Button variant="ghost" href="/academy/faq">
          Read the FAQ
        </Button>
      </PageHero>

      {/* Credibility strip */}
      <div className="border-b border-line bg-asphalt-800">
        <div className="mx-auto grid max-w-content grid-cols-2 gap-px px-5 sm:grid-cols-4 sm:px-8">
          {[
            { big: '17 yrs', small: 'On the road' },
            { big: '0', small: 'Violations' },
            { big: 'CDL-A', small: 'What you earn' },
            { big: 'ELDT', small: 'Compliant program' },
          ].map((s) => (
            <div key={s.small} className="py-6 text-center">
              <p className="font-display text-3xl uppercase text-signal sm:text-4xl">{s.big}</p>
              <p className="mt-1 text-xs uppercase tracking-wide text-muted">{s.small}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Mission */}
      <Section className="border-b border-line">
        <div className="max-w-3xl">
          <Eyebrow>The mission</Eyebrow>
          <h2 className="display-section">Drivers helping drivers</h2>
          <p className="mt-4 text-lg text-muted">
            The trucking industry is full of schools that treat students like a number and lenders
            that treat them like a mark. Trucking Life Academy is the opposite of that. Founder
            Shawn Gresham has spent 17 years in the seat with zero violations, and he built this
            school to hand that experience down the way it should be — straight, practical, and on
            the driver’s side. No fluff. No games. Just the training it takes to earn a CDL-A and
            actually be ready for the road.
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            {['17 years driving', 'Zero violations', 'CDL instructor', 'Driver trainer'].map(
              (b) => (
                <span
                  key={b}
                  className="rounded-card border border-line bg-asphalt-800 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-signal"
                >
                  {b}
                </span>
              ),
            )}
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button variant="ghost" href="/academy/instructors">
              Meet the founder
            </Button>
            <Button variant="ghost" href="/knowledge">
              Free CDL resources
            </Button>
          </div>
        </div>
      </Section>

      {/* The program journey — real curriculum phases, prepare → career */}
      <Section className="border-b border-line bg-asphalt-800">
        <Eyebrow>The program journey</Eyebrow>
        <h2 className="display-section max-w-3xl">From first read to career-ready</h2>
        <p className="mt-4 max-w-2xl text-muted">
          No mystery, no filler. This is the road through the program — and it starts free, before
          you spend a dollar.
        </p>
        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {JOURNEY.map((j, i) => (
            <li key={j.title} className="placard lift flex flex-col p-4 sm:p-6">
              <p className="num-data text-xs font-semibold uppercase tracking-wide text-muted">
                {i + 1} · {j.step}
              </p>
              <h3 className="mt-2 font-display text-xl uppercase text-ink">{j.title}</h3>
              <p className="mt-2 flex-1 text-sm text-muted">{j.description}</p>
              <p className="mt-4">
                <Link
                  href={j.href}
                  className="text-sm font-semibold text-signal underline-offset-4 hover:underline"
                >
                  Learn more →
                </Link>
              </p>
            </li>
          ))}
        </ol>
      </Section>

      {/* Enrollment transparency — the anti-mill move: publish what's known,
          say plainly what isn't. No invented dates, prices, or credentials. */}
      <Section className="border-b border-line">
        <div className="max-w-3xl">
          <Eyebrow>Where the school stands</Eyebrow>
          <h2 className="display-section">Straight answers, published early</h2>
          <p className="mt-4 text-muted">
            Most schools make you sit through a sales call to learn the basics. We publish them —
            including the parts still being finalized.
          </p>
        </div>
        <dl className="mt-8 grid gap-4 sm:grid-cols-2">
          {ENROLLMENT_STATUS.map((row) => (
            <div key={row.label} className="placard p-4 sm:p-6">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">
                {row.label}
              </dt>
              <dd className="mt-2">
                <p className="font-display text-lg uppercase text-ink">{row.value}</p>
                <p className="mt-1 text-sm text-muted">{row.note}</p>
              </dd>
            </div>
          ))}
        </dl>
        <div className="placard placard-money mt-6 flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-6">
          <p className="max-w-xl text-sm text-muted">
            <strong className="text-ink">
              Final enrollment details are being confirmed. Join the interest list for updates
            </strong>{' '}
            — applying costs nothing, collects no payment, and puts you first in line.
          </p>
          <Button href="/academy/apply" className="shrink-0">
            Apply — join the list
          </Button>
        </div>
      </Section>

      {/* Fundraising — live campaign thermometer (same source as /founders) */}
      <Section className="border-b border-line bg-asphalt-800">
        <div className="mx-auto max-w-2xl">
          <Eyebrow>Fund the school</Eyebrow>
          <h2 className="display-section">Built founder by founder</h2>
          <p className="mt-4 text-muted">
            The Academy is funded by drivers and businesses who want this school to exist. Every
            dollar below is the real campaign total.
          </p>
          <div className="mt-6">
            <CampaignThermometer progress={campaign} />
          </div>
          <div className="mt-6">
            <Button href="/founders">Join the Founders Wall</Button>
          </div>
        </div>
      </Section>

      {/* Pillars */}
      <Section className="border-b border-line">
        <Eyebrow>Explore the Academy</Eyebrow>
        <h2 className="display-section mb-8">Everything you need to know</h2>
        <CardGrid cards={PILLARS} />
      </Section>

      {/* Knowledge Center tie-in */}
      <Section className="border-b border-line bg-asphalt-800">
        <div className="max-w-2xl">
          <Eyebrow>Before you enroll</Eyebrow>
          <h2 className="display-section">Start studying for free</h2>
          <p className="mt-4 text-muted">
            You don’t have to wait for day one to get ahead. The Knowledge Center is packed with
            plain-English guides on the CDL permit, the pre-trip inspection, DOT medical cards, and
            Hours of Service — all verified against the regs by a 17-year driver. Want the full head
            start — permit knowledge plus the money, family, and lifestyle prep? That’s{' '}
            <Link href="/cdl-pre-school" className="text-signal underline-offset-4 hover:underline">
              CDL Pre-School
            </Link>
            .
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button href="/knowledge">Open the Knowledge Center</Button>
            <Button variant="ghost" href="/cdl-pre-school">
              CDL Pre-School
            </Button>
            <Link
              href="/knowledge/search?q=CDL%20permit"
              className="inline-flex items-center font-semibold text-signal hover:underline"
            >
              Search “CDL permit” →
            </Link>
          </div>
        </div>
      </Section>

      <Section className="border-b border-line">
        <AcademyFaq faqs={FAQS} />
        <p className="mt-6 text-sm text-muted">
          More questions?{' '}
          <Link href="/academy/faq" className="font-semibold text-signal hover:underline">
            Read the full Academy FAQ →
          </Link>
        </p>
      </Section>

      <CtaBand />
    </>
  );
}
