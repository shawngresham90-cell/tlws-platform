/**
 * CDL Pre-School sales-page content.
 *
 * Every string here is either (a) owner-supplied in the integration brief,
 * (b) already published in this repo (/apps page, Academy pages), or
 * (c) an explicitly-labeled placeholder awaiting owner confirmation.
 * The old cdl-preschool.netlify.app site is egress-blocked from this build
 * environment (see docs/cdl-preschool-integration-audit.md) — nothing was
 * reconstructed from memory and no curriculum details were invented.
 */

export const PRESCHOOL_HEADLINE = 'CDL Pre-School';

export const PRESCHOOL_TAGLINE =
  'Prepare before CDL school. Learn the knowledge, expectations, and real-life preparation new drivers need before training begins.';

/** Verified copy already published on /apps. */
export const PRESCHOOL_APPS_BLURB =
  'Permit prep the driver way — what the test actually asks, without the textbook fog.';

/** Verified benefit bullets already published on /apps. */
export const VERIFIED_BENEFITS = [
  'Built around what the permit test actually asks',
  'Plain talk from a CDL instructor',
  'Study from anywhere — even the passenger seat',
] as const;

/** Section 2 — the problem (owner-supplied framing). */
export const PROBLEMS = [
  {
    title: 'Walking in cold',
    body: 'Most students show up to CDL school never having seen the material. The first week becomes catch-up instead of a head start.',
  },
  {
    title: 'Classroom knowledge gaps',
    body: 'Air brakes, combination vehicles, general knowledge — the permit exam has a language of its own, and schools move fast.',
  },
  {
    title: 'Money and family, unprepared',
    body: 'Training weeks without a paycheck, time away from home, and a family that doesn’t know what’s coming strain more students than the test does.',
  },
  {
    title: 'Lifestyle surprises',
    body: 'Trucking is a life, not just a license. Knowing what the road actually asks of you — before you commit — saves careers.',
  },
  {
    title: 'Choosing a school blind',
    body: 'Contract schools, mega-carrier programs, independent academies — picking wrong can cost thousands and lock you into years.',
  },
] as const;

/** Section 5 — who it's for (owner-supplied). */
export const WHO_ITS_FOR = [
  'Future CDL students who want a head start before day one',
  'People comparing CDL schools and training paths',
  'Students preparing for the permit and classroom phase',
  'Family members trying to understand the trucking lifestyle',
] as const;

/** Section 6 — what it is NOT (owner-supplied, rendered verbatim). */
export const WHAT_IT_IS_NOT = [
  'Not a CDL license — no course can grant one',
  'Not behind-the-wheel training',
  'Not a replacement for ELDT or a registered training provider',
  'Not a promise of employment',
  'Not a guarantee of passing a state exam',
] as const;

/**
 * Section 4 — curriculum. The module list on the original site could not be
 * verified from this environment (egress-blocked; see audit doc). The deploy
 * history confirms workbooks exist. Until the owner confirms the module
 * names/count, the page shows this placeholder and claims NO count.
 */
export const CURRICULUM_CONFIRMED = false;
export const CURRICULUM_PLACEHOLDER = {
  heading: 'The full module list is being finalized for this page',
  body:
    'CDL Pre-School covers permit-exam knowledge the driver way, plus the real-life preparation — money, family, lifestyle, and choosing the right school — that classrooms skip. The complete module-by-module breakdown from the course is being moved onto this page; what you see at checkout is current.',
} as const;

/** Section 9 — FAQs (owner-required questions; answers use only verified facts). */
export const FAQS = [
  {
    question: 'Is this CDL school?',
    answer:
      'No. CDL Pre-School is preparation BEFORE CDL school — knowledge, expectations, and planning. Licensed CDL-A training happens at a registered training provider like Trucking Life Academy.',
  },
  {
    question: 'Does this replace ELDT?',
    answer:
      'No. Entry-Level Driver Training is a federal requirement completed with a registered training provider. CDL Pre-School prepares you for that training; it does not substitute for any part of it.',
  },
  {
    question: 'How do I access the course?',
    answer:
      'Checkout happens securely on Stan Store, and your purchase confirmation there is how course access is delivered. The exact access steps are shown at checkout.',
  },
  {
    question: 'Is the $149 refundable?',
    answer:
      'Purchases are processed by Stan Store, so refund requests go through your Stan Store purchase. Review the terms shown at checkout before you buy — a fuller refund policy for this page is being finalized.',
  },
  {
    question: 'How is my name added to the Founding Student Wall?',
    answer:
      'After you purchase, submit the claim form on this site with the email you used at checkout and your chosen public name. We verify the purchase against Stan Store records by hand, then approve and publish your spot. Nothing is published automatically.',
  },
  {
    question: 'Can I remain anonymous?',
    answer:
      'Yes. Choose the anonymous option on the claim form and your spot shows as "Anonymous Founding Student" — your name is never displayed.',
  },
  {
    question: 'What happens after the first 20 spots sell?',
    answer:
      'The Founding Student offer — the $149 founding price and a permanent spot on the wall — is limited to the first 20 verified students. When the twentieth spot is verified, the founding offer closes.',
  },
  {
    question: 'Does buying guarantee Academy admission?',
    answer:
      'No. CDL Pre-School and Trucking Life Academy admission are separate. The Academy has its own application, requirements, and enrollment process.',
  },
] as const;

/** Section 8 — founder credibility (facts already published on this platform). */
export const CREDIBILITY = {
  heading: 'Built by the driver behind Trucking Life Academy',
  points: [
    '17 years on the road with zero violations',
    'Founder and instructor at Trucking Life Academy — ELDT-compliant CDL-A training in Dalton, GA',
    'Teaches the way drivers actually talk, not the way textbooks do',
  ],
} as const;
