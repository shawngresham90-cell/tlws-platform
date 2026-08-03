import { pending } from '../approval';
import type { NewsletterEmail } from '../render';

/**
 * The Road Report welcome series — four emails, implementation-ready.
 *
 * WHAT IS REAL AND WHAT IS NOT. Every link below points at a route that exists
 * on the site today; the list was taken from `src/app`, not from memory, and a
 * test re-checks it. Every factual statement is one the platform can already
 * back up.
 *
 * Everything that makes a CLAIM — what the Academy costs, what it leads to,
 * what a product does for someone, why they should buy it — is `pending()`.
 * That is not caution for its own sake. Those sentences are promises made in
 * Shawn's name to people who trusted him with an address, and several of them
 * (training outcomes, earnings, job placement) are regulated speech. A
 * plausible-sounding draft is the dangerous kind of placeholder: it reads as
 * finished, so it gets shipped.
 *
 * There is no news, no DOT update, and no promotion anywhere in this file. A
 * welcome series that opened with an invented regulatory change would be worse
 * than no welcome series.
 */

const UNSUB_NOTE = 'You can unsubscribe from any email, including this series.';

export const WELCOME_1: NewsletterEmail = {
  slug: 'welcome-1-road-report',
  subject: 'Welcome to The Road Report',
  previewText: 'What this is, how often it lands, and how to stop it.',
  blocks: [
    {
      kind: 'paragraph',
      text: 'You signed up for The Road Report. Here is exactly what that means, so there are no surprises.',
    },
    { kind: 'heading', text: 'What you are getting' },
    {
      kind: 'paragraph',
      text: pending(
        'one or two sentences describing what The Road Report actually covers — the subjects, not a sales pitch',
      ),
    },
    {
      kind: 'paragraph',
      text: pending(
        'how often it goes out (weekly, monthly, when there is something worth sending) — state the real cadence you intend to keep',
      ),
    },
    { kind: 'heading', text: 'Who is writing it' },
    {
      kind: 'paragraph',
      text: 'Shawn Gresham — a CDL-A driver and instructor based in Dalton, Georgia. Everything here comes from someone who actually drives.',
    },
    { kind: 'divider' },
    { kind: 'heading', text: 'Start here' },
    {
      kind: 'paragraph',
      text: 'The practice tests are free and need no account. If you are working toward a CDL, that is the most useful thing on the site.',
    },
    {
      kind: 'cta',
      label: 'Take a free practice test',
      href: 'https://truckinglifewithshawn.com/practice-tests',
      caption: UNSUB_NOTE,
    },
  ],
};

export const WELCOME_2: NewsletterEmail = {
  slug: 'welcome-2-cdl-resources',
  subject: 'The CDL resources worth your time',
  previewText: 'Free practice tests, the DOT tools, and where to start.',
  blocks: [
    {
      kind: 'paragraph',
      text: 'Studying for a CDL is mostly a question of what to ignore. Here is what is on the site, free, with no account needed.',
    },
    { kind: 'heading', text: 'Practice tests' },
    {
      kind: 'paragraph',
      text: 'Study mode shows you the answer and the reasoning as you go. Timed mode runs like the real thing. Questions you miss are tracked so you can come back to them.',
    },
    {
      kind: 'list',
      items: [
        'Practice tests: truckinglifewithshawn.com/practice-tests',
        'The ones you missed: truckinglifewithshawn.com/practice-tests/missed',
        'Your bookmarks: truckinglifewithshawn.com/practice-tests/bookmarks',
      ],
    },
    { kind: 'heading', text: 'Knowledge Center' },
    {
      kind: 'paragraph',
      text: 'Written guides on getting your CDL, DOT compliance, medical requirements, and the money side of the job. Searchable.',
    },
    { kind: 'heading', text: 'Tools' },
    {
      kind: 'list',
      items: [
        'Hours-of-service calculator: truckinglifewithshawn.com/tools/hos-calculator',
        'Trip planner: truckinglifewithshawn.com/trip-planner',
        'Truck parking directory: truckinglifewithshawn.com/directory/parking',
      ],
    },
    {
      kind: 'correction',
      text: pending(
        'leave this block empty unless a previous issue needs correcting — this is here to show the section renders, and should be deleted before the first real send',
      ),
    },
    {
      kind: 'cta',
      label: 'Browse the Knowledge Center',
      href: 'https://truckinglifewithshawn.com/knowledge',
      caption: UNSUB_NOTE,
    },
  ],
};

export const WELCOME_3: NewsletterEmail = {
  slug: 'welcome-3-academy',
  subject: pending(
    'the subject line for the Academy email — what it should get across, in your words',
  ),
  previewText: pending('one short line of preview text for the Academy email'),
  blocks: [
    {
      kind: 'paragraph',
      text: 'A number of people on this list are trying to work out how to actually get licensed. This one is about that.',
    },
    { kind: 'heading', text: 'Trucking Life Academy' },
    {
      kind: 'paragraph',
      text: pending(
        'what the Academy is, in two or three plain sentences — the program, who it is for, where it is',
      ),
    },
    {
      kind: 'paragraph',
      text: pending(
        'what it costs and what financing exists, or an explicit statement that pricing is on the site — do not let this email imply a price it does not state',
      ),
    },
    {
      kind: 'paragraph',
      text: pending(
        'any outcome you are willing to stand behind in writing. Training outcomes, job placement and earnings claims are regulated — if you are not certain it is defensible, say nothing here instead',
      ),
    },
    { kind: 'divider' },
    {
      kind: 'paragraph',
      text: 'The curriculum, requirements, instructors and FAQ are all on the site, along with the application.',
    },
    {
      kind: 'cta',
      label: pending('the button text for the Academy email'),
      href: 'https://truckinglifewithshawn.com/academy',
      caption: UNSUB_NOTE,
    },
  ],
};

export const WELCOME_4: NewsletterEmail = {
  slug: 'welcome-4-tools-and-products',
  subject: pending('the subject line for the tools and products email'),
  previewText: pending('one short line of preview text for the tools and products email'),
  blocks: [
    {
      kind: 'paragraph',
      text: 'Last one in the series. After this you will only hear from me when there is something worth sending.',
    },
    { kind: 'heading', text: 'The free tools' },
    {
      kind: 'paragraph',
      text: 'These stay free and need no account: the hours-of-service calculator, the trip planner, and the truck parking directory.',
    },
    { kind: 'heading', text: 'The store' },
    {
      kind: 'paragraph',
      text: pending(
        'how you want to introduce the products — what they are and who they are for. Per-product claims about results, earnings or outcomes need to be ones you can defend',
      ),
    },
    {
      kind: 'paragraph',
      text: pending(
        'whether this email should name specific products and prices, or link to the store and let the page do it. Naming prices here means this email has to be re-approved every time one changes',
      ),
    },
    { kind: 'divider' },
    {
      kind: 'paragraph',
      text: 'That is the whole series. If any of it was useful, the best thing you can do is send it to a driver who would want it.',
    },
    {
      kind: 'cta',
      label: pending('the button text for the tools and products email'),
      href: 'https://truckinglifewithshawn.com/store',
      caption: UNSUB_NOTE,
    },
  ],
};

/** The series, in send order. */
export const WELCOME_SERIES: readonly NewsletterEmail[] = [
  WELCOME_1,
  WELCOME_2,
  WELCOME_3,
  WELCOME_4,
];

/**
 * Timing between emails — OWNER DECISION, `ROAD-REPORT-CADENCE-01`.
 *
 * Left unset rather than defaulted. A guessed schedule is the kind of thing
 * that quietly becomes the real one because nobody noticed it was a guess, and
 * send cadence is the single biggest driver of unsubscribes.
 */
export const WELCOME_SERIES_TIMING = pending(
  'how many days between each of the four welcome emails, and whether email 1 goes out immediately on signup',
);
