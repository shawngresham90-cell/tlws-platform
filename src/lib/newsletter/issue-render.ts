import { resolveCopy, type Copy } from './approval';
import { ROAD_REPORT } from './brand';
import type { Cta } from './cta';
import { SECTION_LABELS, type Issue, type IssueSection } from './issue';
import { sourceCredit, type Provenance } from './provenance';
import {
  renderEmail,
  type Block,
  type NewsletterEmail,
  type RenderContext,
  type RenderedEmail,
} from './render';

/**
 * Turn an issue into blocks, then into a finished email.
 *
 * All the layout, escaping, footer and unsubscribe guarantees already live in
 * `render.ts`. This module's only job is deciding which blocks an issue
 * produces — so there is exactly one renderer, and an issue cannot end up with
 * a different footer or a different opt-out from the welcome series.
 *
 * ONLY THE ISSUE'S CTAs BECOME BUTTONS. Section links become `link` blocks,
 * which render as ordinary underlined text. That is what makes "one primary
 * CTA" true in the finished email rather than just in the data: an issue can
 * reference the parking directory, a practice test and a video, and still have
 * exactly one thing that looks like a button.
 */

/** Split prose on blank lines so an author can write paragraphs naturally. */
function paragraphs(body: Copy): Block[] {
  const text = resolveCopy(body);
  // A pending placeholder is one marker, not prose to be split.
  if (typeof body !== 'string') return [{ kind: 'paragraph', text: body }];
  return text
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => ({ kind: 'paragraph', text: part }) as Block);
}

function sectionBlocks(section: IssueSection): Block[] {
  const blocks: Block[] = [{ kind: 'heading', text: section.heading }];

  blocks.push(...paragraphs(section.body));

  if (section.items?.length) {
    blocks.push({ kind: 'list', items: section.items });
  }

  if (section.link) {
    blocks.push({ kind: 'link', label: section.link.label, href: section.link.href });
  }

  if (section.correction) {
    blocks.push({ kind: 'correction', text: section.correction });
  }

  // The credit goes last, under the content it attributes — putting it first
  // would read as a headline rather than as a source.
  const credit = sourceCredit(section.provenance as Provenance);
  if (credit) blocks.push({ kind: 'note', text: credit });

  return blocks;
}

function ctaBlocks(primary: Cta, secondary?: Cta): Block[] {
  const blocks: Block[] = [
    { kind: 'divider' },
    { kind: 'cta', label: primary.label, href: primary.href },
  ];
  // The secondary renders as a text link, not a second button. Two buttons
  // read as two equal asks no matter which one the data calls primary.
  if (secondary) {
    blocks.push({ kind: 'link', label: secondary.label, href: secondary.href });
  }
  return blocks;
}

/** The issue as a `NewsletterEmail`, ready for the shared renderer. */
export function issueToEmail(issue: Issue): NewsletterEmail {
  const blocks: Block[] = [];

  for (const section of issue.sections ?? []) {
    blocks.push(...sectionBlocks(section));
  }

  if (issue.ctas?.primary) {
    blocks.push(...ctaBlocks(issue.ctas.primary, issue.ctas.secondary));
  }

  return {
    slug: issue.slug,
    subject: issue.subject,
    previewText: issue.previewText,
    blocks,
  };
}

export function renderIssue(issue: Issue, ctx: RenderContext): RenderedEmail {
  return renderEmail(issueToEmail(issue), ctx);
}

/**
 * A one-line description of an issue for a preview index or an audit entry.
 * Carries no recipient data — an issue summary should be safe to paste
 * anywhere.
 */
export function describeIssue(issue: Issue): string {
  const kinds = (issue.sections ?? []).map((s) => SECTION_LABELS[s.kind] ?? s.kind);
  return `${ROAD_REPORT.name} #${issue.number} (${issue.slug}, ${issue.date}) — ${issue.state} — ${kinds.length} sections: ${kinds.join(', ')}`;
}
