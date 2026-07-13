/**
 * CDL Pre-School sales-page content.
 *
 * Every string here is verified against one of: (a) the owner's integration
 * brief, (b) this repo's already-published copy (/apps, Academy pages), or
 * (c) the real CDL Pre-School source — the `shawngresham90-cell/cdl-preschool`
 * repository (read-only audit, commit f6a004c = the live Netlify deploy) and
 * the portal's production course tables (7 modules / 33 lessons, read-only).
 * See docs/cdl-preschool-integration-audit.md for the full source map.
 *
 * Deliberately NOT claimed anywhere (unverified or false): instant access,
 * lifetime access, refund terms, testimonials, guaranteed exam/job/Academy
 * outcomes. Module summaries below paraphrase the course's own public-facing
 * module descriptions — no paid lesson content is reproduced.
 */

export const PRESCHOOL_HEADLINE = 'CDL Pre-School';

export const PRESCHOOL_TAGLINE =
  'Prepare before CDL school. Learn the knowledge, expectations, and real-life preparation new drivers need before training begins.';

/** Verified copy already published on /apps. */
export const PRESCHOOL_APPS_BLURB =
  'Permit prep the driver way — what the test actually asks, without the textbook fog.';

/** Verified against the portal's production course tables. */
export const MODULE_COUNT = 7;
export const LESSON_COUNT = 33;
export const QUIZ_PASS_PERCENT = 80;
export const CURRICULUM_CONFIRMED = true;

/**
 * The real curriculum — 7 modules, 33 lessons, grouped for the sales page.
 * Titles and one-line summaries mirror the course's own module descriptions.
 */
export const CURRICULUM_GROUPS = [
  {
    heading: 'Get ready before day one',
    modules: [
      {
        number: 1,
        title: 'Before You Ever Touch a Truck',
        lessons: 5,
        summary:
          'The mindset, money, and paperwork that separate drivers who make it from the ones who wash out.',
      },
      {
        number: 2,
        title: 'Choosing the Right CDL School (Not a Mill)',
        lessons: 5,
        summary:
          'How to vet schools, dodge CDL mills, and pick between company-sponsored training and paying your own way.',
      },
    ],
  },
  {
    heading: 'Pass the permit',
    modules: [
      {
        number: 3,
        title: 'Crushing the Permit Tests',
        lessons: 5,
        summary:
          'General Knowledge, Air Brakes, and Combination Vehicles — what’s actually on them and how to study so it sticks.',
      },
    ],
  },
  {
    heading: 'Master the skills',
    modules: [
      {
        number: 4,
        title: 'The Pre-Trip That Passes Every Time',
        lessons: 5,
        summary: 'The inspection walk-through examiners want to see, step by step.',
      },
      {
        number: 5,
        title: 'Backing, Turning & Truck Control',
        lessons: 5,
        summary: 'The yard maneuvers that fail the most students and how to nail them.',
      },
      {
        number: 6,
        title: 'On the Road Without the Panic',
        lessons: 4,
        summary: 'Shifting, space management, and driving big without freezing up.',
      },
    ],
  },
  {
    heading: 'Start the career',
    modules: [
      {
        number: 7,
        title: 'Land the Job & Keep It',
        lessons: 4,
        summary: 'Getting hired, your first weeks, and building a clean record from day one.',
      },
    ],
  },
] as const;

/** Section 3 — what you get. Every line verified in the course source. */
export const WHATS_INCLUDED = [
  `${MODULE_COUNT} modules / ${LESSON_COUNT} self-paced lessons in a private student portal`,
  'A workbook with every lesson, plus a printable cheat-sheet for each module',
  `A quiz at the end of every module — score ${QUIZ_PASS_PERCENT}% to unlock the next one`,
  'Lessons unlock in order, so you build on what you just learned',
  'A completion certificate with its own online verification page',
  'Works on your phone — progress saves automatically',
  'Your own login (email + password) issued personally after purchase',
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
 * Section 9 — FAQs. Answers verified against the course source. There is no
 * published refund policy anywhere in the course source, so per the content
 * rules the refund question is intentionally ABSENT rather than answered with
 * an invented policy — the owner can add one once terms are written.
 */
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
      'Checkout happens securely on Stan Store. After your purchase, Shawn verifies it and personally enrolls you in the private student portal — you’ll receive a welcome email with your own login and a temporary password. Access is issued by hand, not by an automated redirect, so give it a little time. The course is self-paced, works on your phone, and saves your progress automatically.',
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
