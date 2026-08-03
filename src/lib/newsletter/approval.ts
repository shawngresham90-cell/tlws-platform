/**
 * Owner approval — enforced by rendering, not by convention.
 *
 * THE FAILURE THIS PREVENTS. Placeholder copy is normally marked in a comment
 * or a checklist, which means the rendered email looks completely shippable.
 * Someone opens a preview, sees polished-looking copy, and sends it — and the
 * marketing claim nobody approved goes to the whole list. The comment was right
 * there in the source; it just was not in the thing anyone looked at.
 *
 * So a placeholder is a VALUE here, not a note. `pending()` produces copy that
 * renders as a loud inline marker in both the HTML and the plain-text body. Two
 * consequences, and both are the point:
 *
 *   1. A human previewing the email cannot miss it.
 *   2. `findPendingCopy()` can find it by reading the finished output, which
 *      means the send gate checks what would ACTUALLY be transmitted rather
 *      than trusting a flag someone remembered to set.
 *
 * A gate that inspects metadata can be defeated by forgetting to write the
 * metadata. A gate that inspects the rendered bytes cannot.
 */

/**
 * The marker string. Deliberately shouty and unique — it must survive being
 * pasted into an email client, and it must never plausibly occur in real copy.
 */
export const OWNER_APPROVAL_MARKER = 'OWNER_APPROVAL_REQUIRED';

/** Copy Shawn has not approved yet. Carries a description of what is needed. */
export type PendingCopy = {
  readonly __pending: true;
  /** What the approved text has to say, phrased as a request — never as draft copy. */
  readonly needs: string;
};

/** A string of real copy, or a marked placeholder standing in for one. */
export type Copy = string | PendingCopy;

/**
 * Mark a piece of copy as awaiting owner approval.
 *
 * `needs` describes what the approved text must convey. It is deliberately a
 * REQUEST, not a suggestion: writing plausible marketing copy here and calling
 * it a placeholder is how unapproved claims get shipped — someone reads it,
 * thinks it looks fine, and deletes the marker instead of writing the real
 * thing.
 */
export function pending(needs: string): PendingCopy {
  return { __pending: true, needs };
}

export function isPending(value: Copy): value is PendingCopy {
  return typeof value === 'object' && value !== null && '__pending' in value;
}

/** How a placeholder appears in the finished email, in both HTML and text. */
export function renderPending(copy: PendingCopy): string {
  return `[${OWNER_APPROVAL_MARKER}: ${copy.needs}]`;
}

/** Resolve copy to a string. Placeholders become their visible marker. */
export function resolveCopy(copy: Copy): string {
  return isPending(copy) ? renderPending(copy) : copy;
}

/**
 * Collapse whitespace so a marker reads the same wherever it was found.
 *
 * The plain-text renderer wraps long lines, which puts newlines INSIDE a
 * marker. Without this, the same placeholder is found twice — once as it
 * appears in the HTML and once line-broken as it appears in the text — and the
 * count of things awaiting approval comes out roughly double. Worse, a reader
 * comparing the two lists would see items that look subtly different and go
 * looking for a difference that is not there.
 */
function normalizeForScan(body: string): string {
  return body.replace(/\s+/g, ' ');
}

/**
 * Every unapproved item in a finished email, found by reading the output.
 *
 * Scans the rendered HTML and text rather than the template's inputs, so it
 * catches a placeholder wherever it came from — including one that arrived
 * through an interpolated variable the template author never considered.
 */
export function findPendingCopy(rendered: { html: string; text: string }): string[] {
  const found = new Set<string>();
  const pattern = new RegExp(`\\[${OWNER_APPROVAL_MARKER}: ([^\\]]*)\\]`, 'g');
  for (const body of [rendered.html, rendered.text]) {
    for (const m of normalizeForScan(body).matchAll(pattern)) {
      found.add(m[1].trim());
    }
  }
  return [...found];
}

/**
 * True when the rendered email still contains anything awaiting approval.
 *
 * Checks the whitespace-normalized bodies for the same reason as above: the
 * gate must not be defeatable by a line break landing in an awkward place.
 */
export function hasPendingCopy(rendered: { html: string; text: string }): boolean {
  return [rendered.html, rendered.text].some((body) =>
    normalizeForScan(body).includes(OWNER_APPROVAL_MARKER),
  );
}
