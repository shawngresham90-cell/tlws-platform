import { findPendingCopy, isPending, resolveCopy, type Copy } from './approval';
import { validateCtas } from './cta';
import {
  SECTION_KINDS,
  SECTION_LABELS,
  SOURCE_REQUIRED_SECTIONS,
  sectionOrder,
  type Issue,
  type IssueSection,
  type SectionKind,
} from './issue';
import { isPlaceholderProvenance, validateProvenance } from './provenance';
import type { RenderedEmail } from './render';

/**
 * Everything that must be true before an issue may move forward.
 *
 * TWO PASSES, BECAUSE THERE ARE TWO KINDS OF DEFECT. Structural problems live
 * in the issue data — a duplicate section, an unlabelled source, no CTA. Output
 * problems live in the rendered bytes — a missing footer, a missing unsubscribe
 * link, a placeholder that survived. Checking only the data would miss anything
 * the renderer did or failed to do; checking only the output would report
 * "unsubscribe link missing" for an issue whose real problem is that it has no
 * sections at all.
 *
 * EVERY PROBLEM IS RETURNED, never the first. The person fixing an issue at
 * 11pm on send night should get one list, not a sequence of surprises.
 *
 * SEVERITY IS NOT ADVISORY. There is one level, and it blocks. A "warning" tier
 * would be a list of things everyone learns to scroll past.
 */

export type IssueProblem = {
  code: string;
  detail: string;
  /** Which section it came from, when it came from one. */
  section?: SectionKind;
};

export type IssueValidation = {
  ok: boolean;
  problems: IssueProblem[];
};

function copyIsBlank(value: Copy): boolean {
  return !isPending(value) && resolveCopy(value).trim().length === 0;
}

/* ── Structural: the issue data ──────────────────────────────────────────── */

export function validateIssueStructure(issue: Issue): IssueProblem[] {
  const problems: IssueProblem[] = [];

  if (!issue.slug || !issue.slug.trim()) {
    problems.push({ code: 'issue_slug_missing', detail: 'The issue needs a stable slug.' });
  }
  if (!Number.isInteger(issue.number) || issue.number < 1) {
    problems.push({
      code: 'issue_number_invalid',
      detail: 'The issue number must be a positive integer.',
    });
  }
  if (!/^\d{4}-\d{2}-\d{2}/.test(issue.date ?? '') || Number.isNaN(Date.parse(issue.date))) {
    problems.push({ code: 'issue_date_invalid', detail: 'The issue needs a valid ISO date.' });
  }
  if (copyIsBlank(issue.subject)) {
    problems.push({ code: 'issue_subject_blank', detail: 'The issue has no subject line.' });
  }
  if (copyIsBlank(issue.previewText)) {
    problems.push({
      code: 'issue_preview_text_blank',
      detail:
        'The issue has no preview text. Without it the inbox shows the first words of the body, which is usually the greeting.',
    });
  }

  if (!Array.isArray(issue.sections) || issue.sections.length === 0) {
    problems.push({ code: 'issue_no_sections', detail: 'The issue has no sections.' });
    return problems.concat(validateCtas(issue.ctas));
  }

  // Duplicate sections.
  const seen = new Map<SectionKind, number>();
  for (const section of issue.sections) {
    seen.set(section.kind, (seen.get(section.kind) ?? 0) + 1);
  }
  for (const [kind, count] of seen) {
    if (count > 1) {
      problems.push({
        code: 'section_duplicated',
        section: kind,
        detail: `"${SECTION_LABELS[kind] ?? kind}" appears ${count} times. Each section kind may appear at most once — two of the same section reads as a copy-paste error and doubles the issue's length for no new content.`,
      });
    }
  }

  // Unknown kinds.
  for (const section of issue.sections) {
    if (!(SECTION_KINDS as readonly string[]).includes(section.kind)) {
      problems.push({
        code: 'section_kind_unknown',
        detail: `Unrecognised section kind ${JSON.stringify(section.kind)}.`,
      });
    }
  }

  // Running order.
  const known = issue.sections.filter((s) => (SECTION_KINDS as readonly string[]).includes(s.kind));
  for (let i = 1; i < known.length; i++) {
    if (sectionOrder(known[i].kind) < sectionOrder(known[i - 1].kind)) {
      problems.push({
        code: 'section_out_of_order',
        section: known[i].kind,
        detail: `"${SECTION_LABELS[known[i].kind]}" appears after "${SECTION_LABELS[known[i - 1].kind]}". Sections follow the canonical running order so every issue reads the same way.`,
      });
    }
  }

  for (const section of issue.sections) {
    problems.push(...validateSection(section));
  }

  problems.push(...validateCtas(issue.ctas).map((p) => ({ code: p.code, detail: p.detail })));
  return problems;
}

function validateSection(section: IssueSection): IssueProblem[] {
  const problems: IssueProblem[] = [];
  const kind = section.kind;

  if (copyIsBlank(section.heading)) {
    problems.push({
      code: 'section_heading_blank',
      section: kind,
      detail: 'Section has no heading.',
    });
  }
  if (copyIsBlank(section.body) && !(section.items && section.items.length > 0)) {
    problems.push({
      code: 'section_empty',
      section: kind,
      detail: 'Section has neither body text nor list items.',
    });
  }

  // Invalid source labels — including entirely absent ones.
  for (const problem of validateProvenance(section.provenance)) {
    problems.push({ ...problem, section: kind });
  }

  // Sections that state outside facts may not be owner-written from memory.
  const provenanceKind = (section.provenance as { kind?: unknown } | undefined)?.kind;
  if (SOURCE_REQUIRED_SECTIONS.includes(kind) && provenanceKind === 'owner-written') {
    problems.push({
      code: 'section_requires_official_source',
      section: kind,
      detail: `"${SECTION_LABELS[kind]}" states facts about the outside world, so it needs an official source rather than being written from memory. A driver may act on what this section says.`,
    });
  }

  if (section.link) {
    const href = resolveCopy(section.link.href);
    if (!isPending(section.link.href)) {
      try {
        const url = new URL(href);
        if (url.protocol !== 'https:' && url.protocol !== 'http:') {
          problems.push({
            code: 'section_link_not_web',
            section: kind,
            detail: `Section link is not http(s): ${href}`,
          });
        }
      } catch {
        problems.push({
          code: 'section_link_invalid',
          section: kind,
          detail: `Section link is not an absolute URL: ${href}. Email has no page for a relative link to resolve against.`,
        });
      }
    }
    if (copyIsBlank(section.link.label)) {
      problems.push({
        code: 'section_link_label_blank',
        section: kind,
        detail: 'Section link has no label.',
      });
    }
  }

  return problems;
}

/* ── Output: the rendered bytes ──────────────────────────────────────────── */

export type RenderedExpectations = {
  /** The exact unsubscribe URL this render was given. */
  unsubscribeUrl: string;
  /** The publisher name that must appear in the footer. */
  publisher: string;
};

/**
 * Check the finished email rather than the inputs.
 *
 * The footer and unsubscribe link are appended structurally by the renderer, so
 * in normal operation these cannot fail — which is exactly why they are worth
 * asserting here. This is the check that notices if that guarantee is ever
 * quietly removed, and it costs nothing to keep.
 */
export function validateRenderedIssue(
  rendered: RenderedEmail,
  expected: RenderedExpectations,
): IssueProblem[] {
  const problems: IssueProblem[] = [];

  for (const [part, body] of [
    ['HTML', rendered.html],
    ['plain text', rendered.text],
  ] as const) {
    if (!body.includes(expected.unsubscribeUrl)) {
      problems.push({
        code: 'rendered_unsubscribe_missing',
        detail: `The ${part} part does not contain the unsubscribe link. This must never ship.`,
      });
    }
    // The URL itself contains the word "unsubscribe", so it has to come out
    // before looking for visible wording — otherwise this check passes purely
    // because the link is present, which is the thing it is supposed to be
    // independent of.
    const withoutUrl = body.split(expected.unsubscribeUrl).join(' ');
    if (!/unsubscribe/i.test(withoutUrl)) {
      problems.push({
        code: 'rendered_unsubscribe_unlabelled',
        detail: `The ${part} part has no visible "unsubscribe" wording outside the link itself. A bare URL is not an opt-out a reader can find.`,
      });
    }
    if (!body.includes(expected.publisher)) {
      problems.push({
        code: 'rendered_sender_missing',
        detail: `The ${part} part does not name the sender. Commercial email must identify who sent it.`,
      });
    }
    if (!/receiving this because/i.test(body)) {
      problems.push({
        code: 'rendered_footer_missing',
        detail: `The ${part} part is missing the footer explaining why the reader is receiving it.`,
      });
    }
  }

  // Placeholders left behind.
  const pendingItems = findPendingCopy(rendered);
  if (pendingItems.length > 0) {
    problems.push({
      code: 'placeholder_left_behind',
      detail: `${pendingItems.length} placeholder(s) still in the rendered issue: ${pendingItems.join(' | ')}`,
    });
  }

  return problems;
}

/* ── The whole thing ─────────────────────────────────────────────────────── */

/**
 * Full validation. `ok` is the value the approval workflow consults before
 * allowing any forward transition.
 */
export function validateIssue(
  issue: Issue,
  rendered: RenderedEmail,
  expected: RenderedExpectations,
): IssueValidation {
  const problems = [...validateIssueStructure(issue), ...validateRenderedIssue(rendered, expected)];

  // A section still marked `placeholder` blocks publication even if its copy
  // happens to be filled in — the label is the author's own statement that this
  // is not finished, and it outranks how complete the prose looks.
  for (const section of issue.sections ?? []) {
    if (isPlaceholderProvenance(section.provenance)) {
      problems.push({
        code: 'section_still_placeholder',
        section: section.kind,
        detail: `"${SECTION_LABELS[section.kind] ?? section.kind}" is still labelled a placeholder.`,
      });
    }
  }

  return { ok: problems.length === 0, problems };
}
