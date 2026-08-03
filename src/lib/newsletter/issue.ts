import type { Copy } from './approval';
import type { Cta, IssueCtas } from './cta';
import type { Provenance } from './provenance';
import type { IssueState } from './workflow-state';

/**
 * The shape of one weekly issue of The Road Report.
 *
 * A DATA STRUCTURE, NOT A CMS. An issue is a TypeScript value in a file,
 * committed and reviewed like anything else. That is a deliberate refusal to
 * build a newsroom: the editorial workflow here is one author, one reviewer,
 * once a week. A database-backed editor would add a schema, an admin UI, an
 * auth surface and a migration — to serve a review step that a pull request
 * already does better, with history and line comments for free.
 *
 * SECTIONS ARE ORDERED AND OPTIONAL. A week with no fuel news should not ship a
 * fuel section reading "no updates this week"; it should ship without one. The
 * twelve kinds below are the vocabulary, not a required checklist.
 *
 * EVERY SECTION CARRIES PROVENANCE. See provenance.ts — the rule that unknown
 * cannot publish is the reason this field is not optional.
 */

/**
 * The twelve section kinds. Order here is the canonical running order of an
 * issue: the note that opens it, the news, the practical material, the
 * platform's own items, then the sign-off. An issue's sections are validated
 * against this order so a fuel update cannot land after the closing note.
 */
export const SECTION_KINDS = [
  'opening-note',
  'industry-news',
  'dot-fmcsa',
  'fuel',
  'weather',
  'driver-tip',
  'parking-spotlight',
  'featured-practice-test',
  'academy-update',
  'store-spotlight',
  'youtube-video',
  'closing-note',
] as const;
export type SectionKind = (typeof SECTION_KINDS)[number];

export const SECTION_LABELS: Record<SectionKind, string> = {
  'opening-note': 'Opening note',
  'industry-news': 'Industry news',
  'dot-fmcsa': 'DOT / FMCSA',
  fuel: 'Fuel',
  weather: 'Weather',
  'driver-tip': 'Driver tip',
  'parking-spotlight': 'Parking spotlight',
  'featured-practice-test': 'Featured practice test',
  'academy-update': 'Academy update',
  'store-spotlight': 'Store spotlight',
  'youtube-video': 'YouTube video',
  'closing-note': 'Closing note',
};

/**
 * Sections that state facts about the outside world, where an unsourced claim
 * is actively harmful rather than merely unattributed. A driver who reads an
 * invented hours-of-service change in this newsletter may act on it.
 *
 * These may not be `owner-written`: Shawn writing "FMCSA changed X" from memory
 * is exactly the failure mode. They are `official-source` or nothing.
 */
export const SOURCE_REQUIRED_SECTIONS: readonly SectionKind[] = [
  'industry-news',
  'dot-fmcsa',
  'fuel',
  'weather',
];

/**
 * An inline reference link inside a section — the practice test being featured,
 * the parking location, the video.
 *
 * NOT A CTA. This renders as an ordinary inline text link, never as a button.
 * The distinction is what lets an issue mention eight things while asking for
 * exactly one, and the renderer enforces it: only `issue.ctas` produces button
 * markup.
 */
export type SectionLink = { label: Copy; href: Copy };

export type IssueSection = {
  kind: SectionKind;
  heading: Copy;
  /** The prose. One or more paragraphs, split on blank lines by the renderer. */
  body: Copy;
  /** Optional bullets, for sections that are naturally a list. */
  items?: Copy[];
  /** Where this content came from. Required — see provenance.ts. */
  provenance: Provenance;
  /** At most one inline reference link. */
  link?: SectionLink;
  /** A correction to a previous issue, rendered in the correction block. */
  correction?: Copy;
};

export type Issue = {
  /** Stable id, e.g. `2026-w32`. Used in the audit log and the preview filename. */
  slug: string;
  /** Sequential issue number, shown in the masthead. */
  number: number;
  /** ISO date this issue is intended to go out. */
  date: string;
  state: IssueState;
  subject: Copy;
  previewText: Copy;
  sections: IssueSection[];
  ctas: IssueCtas;
};

/** Position of a section kind in the canonical running order. */
export function sectionOrder(kind: SectionKind): number {
  return SECTION_KINDS.indexOf(kind);
}

export type { Cta, IssueCtas, Provenance, IssueState };
