/**
 * Where a section's content came from — and the rule that unknown cannot ship.
 *
 * THE FAILURE THIS PREVENTS. A weekly issue is assembled quickly from many
 * places: a regulator's notice, something Shawn wrote himself, and a slot that
 * is still a stub. Those three are indistinguishable once they are rendered as
 * paragraphs. The one that must never go out unattributed is the first — a
 * sentence about hours-of-service that reads as authoritative but has no source
 * behind it is the single worst thing this newsletter could publish, because
 * drivers act on it.
 *
 * So provenance is a required field on every section, and the validator treats
 * anything it does not positively recognise as UNKNOWN — which blocks
 * publication. Not "assume owner-written", not "warn and continue". A section
 * whose origin nobody can state is exactly the section that should not go out.
 *
 * `official-source` carries a publisher, a URL and a retrieval date because a
 * citation without them is not a citation. The URL is checked to be a real
 * absolute http(s) URL rather than trusted, since a broken source link is
 * indistinguishable from a fabricated one to the reader.
 */

export const PROVENANCE_KINDS = ['official-source', 'owner-written', 'placeholder'] as const;
export type ProvenanceKind = (typeof PROVENANCE_KINDS)[number];

export type Provenance =
  | {
      kind: 'official-source';
      /** Who published it — "FMCSA", "NOAA", "EIA". Not a paraphrase of the URL. */
      publisher: string;
      /** Absolute http(s) link to the source document. */
      url: string;
      /** ISO date the source was read. A regulation cited from memory is not sourced. */
      retrievedAt: string;
    }
  | { kind: 'owner-written' }
  | { kind: 'placeholder' };

export type ProvenanceProblem = { code: string; detail: string };

function isIsoDate(value: unknown): boolean {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}/.test(value)) return false;
  return !Number.isNaN(Date.parse(value));
}

function isAbsoluteHttpUrl(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Validate a provenance value that arrived as `unknown`.
 *
 * Takes `unknown` rather than `Provenance` deliberately. Typing the parameter
 * as `Provenance` would mean the only values ever checked are ones TypeScript
 * already proved correct, and the malformed value that actually matters —
 * hand-edited data, a renamed field, a stale draft — would slip past at the one
 * point it could have been caught.
 */
export function validateProvenance(value: unknown): ProvenanceProblem[] {
  if (typeof value !== 'object' || value === null) {
    return [
      { code: 'provenance_missing', detail: 'Section has no provenance. Unknown cannot publish.' },
    ];
  }
  const record = value as Record<string, unknown>;
  const kind = record.kind;

  if (typeof kind !== 'string' || !(PROVENANCE_KINDS as readonly string[]).includes(kind)) {
    return [
      {
        code: 'provenance_unknown_kind',
        detail: `Source label ${JSON.stringify(kind)} is not one of: ${PROVENANCE_KINDS.join(', ')}. Unknown cannot publish.`,
      },
    ];
  }

  if (kind !== 'official-source') return [];

  const problems: ProvenanceProblem[] = [];
  if (typeof record.publisher !== 'string' || record.publisher.trim().length === 0) {
    problems.push({
      code: 'provenance_publisher_missing',
      detail: 'An official source must name its publisher.',
    });
  }
  if (!isAbsoluteHttpUrl(record.url)) {
    problems.push({
      code: 'provenance_url_invalid',
      detail: `An official source needs an absolute http(s) URL. Got ${JSON.stringify(record.url)}.`,
    });
  }
  if (!isIsoDate(record.retrievedAt)) {
    problems.push({
      code: 'provenance_retrieved_at_invalid',
      detail: 'An official source must record the ISO date it was read.',
    });
  }
  return problems;
}

/** True when this section's content is still a stub. */
export function isPlaceholderProvenance(value: unknown): boolean {
  return (
    typeof value === 'object' &&
    value !== null &&
    (value as { kind?: unknown }).kind === 'placeholder'
  );
}

/**
 * How a source is credited to the reader.
 *
 * Owner-written content gets no line — Shawn's own words in Shawn's own
 * newsletter need no citation, and adding "Source: Trucking Life with Shawn"
 * to every paragraph would train readers to skip the line that matters.
 * Placeholders get nothing here either; they are already loudly marked by the
 * approval machinery.
 */
export function sourceCredit(provenance: Provenance): string | null {
  return provenance.kind === 'official-source'
    ? `Source: ${provenance.publisher} — ${provenance.url} (retrieved ${provenance.retrievedAt.slice(0, 10)})`
    : null;
}
