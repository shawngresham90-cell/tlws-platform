import { pending } from '../approval';
import type { Issue, IssueSection } from '../issue';

/**
 * The blank weekly issue — the thing an author copies to start a new one.
 *
 * EVERY SECTION IS A PLACEHOLDER, and every one is labelled
 * `provenance: { kind: 'placeholder' }`. That makes this file a working
 * demonstration of the gate rather than a document about it: run the validator
 * against `BLANK_ISSUE` and it refuses to publish, listing all twelve sections.
 * As sections are filled in and relabelled, the refusals disappear one at a
 * time. When the list is empty, the issue is publishable — and not before.
 *
 * NOTHING HERE IS CONTENT. There is no example fuel price, no sample DOT
 * notice, no "last week's news" written to look real. A template that ships
 * with plausible filler is a template someone eventually sends: the filler
 * reads as finished, so it survives the skim. Each `pending()` states what the
 * section needs, phrased as a question to the author.
 *
 * SECTIONS ARE OPTIONAL IN A REAL ISSUE. All twelve appear here because this is
 * the menu. A week with nothing worth saying about fuel ships without a fuel
 * section — not with one reading "no updates".
 */

const placeholder = { kind: 'placeholder' } as const;

export const BLANK_ISSUE_SECTIONS: IssueSection[] = [
  {
    kind: 'opening-note',
    heading: pending('the opening-note heading for this issue'),
    body: pending(
      'two or three sentences in your own voice setting up the week — what happened, what this issue is about',
    ),
    provenance: placeholder,
  },
  {
    kind: 'industry-news',
    heading: pending('the industry-news heading'),
    body: pending(
      'what happened in the industry this week, in plain language, with the publisher and link recorded in provenance. This section may not be written from memory',
    ),
    provenance: placeholder,
  },
  {
    kind: 'dot-fmcsa',
    heading: pending('the DOT/FMCSA heading'),
    body: pending(
      'the regulatory item, what it actually changes, and who it applies to. Cite the official notice. Drivers act on this section — if the source cannot be linked, drop the section rather than paraphrasing it',
    ),
    provenance: placeholder,
  },
  {
    kind: 'fuel',
    heading: pending('the fuel heading'),
    body: pending(
      'the fuel picture this week, sourced to a published dataset rather than to a recollection or a screenshot',
    ),
    provenance: placeholder,
  },
  {
    kind: 'weather',
    heading: pending('the weather heading'),
    body: pending(
      'the weather that will actually affect driving this week, sourced to an official forecast. Name the corridors or regions',
    ),
    provenance: placeholder,
  },
  {
    kind: 'driver-tip',
    heading: pending('the driver-tip heading'),
    body: pending('one practical thing you know from driving that a reader can use this week'),
    provenance: placeholder,
  },
  {
    kind: 'parking-spotlight',
    heading: pending('the parking-spotlight heading'),
    body: pending(
      'the location being featured and why it is worth knowing — spaces, amenities, the exit, what to watch out for',
    ),
    provenance: placeholder,
    link: {
      label: pending('the link text for the parking listing'),
      href: pending('the directory URL for this location, from the live site'),
    },
  },
  {
    kind: 'featured-practice-test',
    heading: pending('the practice-test heading'),
    body: pending('which test is featured and who should take it'),
    provenance: placeholder,
    link: {
      label: pending('the link text for the practice test'),
      href: pending('the practice-test URL, from the live site'),
    },
  },
  {
    kind: 'academy-update',
    heading: pending('the Academy heading'),
    body: pending(
      'what is genuinely new at the Academy. Outcome, earnings and placement claims are regulated — say nothing here you could not defend in writing',
    ),
    provenance: placeholder,
  },
  {
    kind: 'store-spotlight',
    heading: pending('the store heading'),
    body: pending(
      'which product is featured and who it is for. No discount language, guarantees or income claims unless you have approved that exact wording',
    ),
    provenance: placeholder,
  },
  {
    kind: 'youtube-video',
    heading: pending('the video heading'),
    body: pending('what the video covers and why it is worth the time'),
    provenance: placeholder,
    link: {
      label: pending('the link text for the video'),
      href: pending('the YouTube URL for this video'),
    },
  },
  {
    kind: 'closing-note',
    heading: pending('the closing-note heading'),
    body: pending('how you want to sign off, and anything you want readers to send back'),
    provenance: placeholder,
  },
];

/**
 * A complete blank issue. `state` starts at `draft`, which is the only state
 * from which anything can begin.
 */
export const BLANK_ISSUE: Issue = {
  slug: 'YYYY-wNN',
  number: 1,
  date: '1970-01-01',
  state: 'draft',
  subject: pending('the subject line for this issue'),
  previewText: pending('one short line of preview text — the grey line after the subject'),
  sections: BLANK_ISSUE_SECTIONS,
  ctas: {
    primary: {
      label: pending('the primary CTA button text'),
      href: pending('the primary CTA destination'),
      intent: 'read',
    },
  },
};

/**
 * Sections that are almost always worth including, as a starting subset for an
 * author who does not want all twelve. Not a rule — a suggestion the validator
 * knows nothing about.
 */
export const CORE_SECTIONS = ['opening-note', 'dot-fmcsa', 'driver-tip', 'closing-note'] as const;
