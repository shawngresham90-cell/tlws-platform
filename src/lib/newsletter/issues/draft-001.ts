import { pending } from '../approval';
import type { Issue } from '../issue';
import { BLANK_ISSUE_SECTIONS } from '../campaigns/issue-template';

/**
 * The first issue — a working draft, and the system's own proof that it works.
 *
 * This is the blank template instantiated. Every section is still labelled
 * `placeholder`, so running the validator against it produces a refusal listing
 * all twelve, and `transition()` will not move it out of `draft`. That is the
 * whole pipeline demonstrated on a real object rather than described in a
 * document: preview it, validate it, watch it refuse.
 *
 * WHAT MAKES THIS SAFE TO COMMIT. It contains no content. There is no invented
 * fuel price, no fabricated DOT notice, no sample news. Every field is either a
 * marker naming what the author must supply, or a structural value like the
 * issue number. Nothing here could mislead a reader if it somehow escaped,
 * because it says, in the rendered body, that it is unfinished.
 *
 * A real issue replaces the markers, relabels each section's provenance, sets a
 * real date, and moves through the states. This file stays as the reference.
 */
export const DRAFT_ISSUE_001: Issue = {
  slug: 'draft-001',
  number: 1,
  // A real date is required by the validator; the issue is not scheduled until
  // an author sets one. This one is deliberately in the past so it can never be
  // mistaken for a send date somebody intended.
  date: '1970-01-01',
  state: 'draft',
  subject: pending('the subject line for issue #1'),
  previewText: pending('one short line of preview text for issue #1'),
  sections: BLANK_ISSUE_SECTIONS,
  ctas: {
    primary: {
      label: pending('the primary CTA button text for issue #1'),
      href: pending('the primary CTA destination for issue #1'),
      intent: 'read',
    },
  },
};
