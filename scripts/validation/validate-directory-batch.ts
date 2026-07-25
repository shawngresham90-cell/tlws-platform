/**
 * Directory batch VALIDATORS (pure, no I/O). Everything here inspects text that
 * was already produced by the research process — it never fetches a URL and
 * never writes. Live source-link fetching is deliberately NOT done here:
 * network egress is gated in this environment, so link checking is limited to
 * well-formedness and the batch's own provenance record. A future run with
 * network permission can layer a real HEAD-check on top of `extractSourceLinks`.
 *
 * Reuses the canonical import gate (prepareImport) for the CSV itself and only
 * adds the provenance / verified-date / link-shape checks the importer does not
 * cover.
 */
import { prepareImport, importDupKey } from '@/lib/directory/import';

// ---------------------------------------------------------------------------
// CSV cleanliness through the REAL importer
// ---------------------------------------------------------------------------

export type CsvCleanReport = {
  total: number;
  imported: number;
  skipped: number;
  duplicates: number;
  errorCount: number;
  errors: { row: number; message: string }[];
  clean: boolean;
};

/**
 * Run a batch CSV through prepareImport with a supplied existing-key set and
 * report whether it is 100% clean (every data row imported, nothing skipped or
 * errored). This is the same gate the admin import uses — no parallel parser.
 */
export function validateBatchCsv(
  csvText: string,
  existingKeys: Set<string> = new Set(),
): CsvCleanReport {
  const { summary } = prepareImport(csvText, existingKeys);
  return {
    total: summary.totalRows,
    imported: summary.imported,
    skipped: summary.skipped,
    duplicates: summary.duplicates,
    errorCount: summary.errors.length,
    errors: summary.errors,
    clean: summary.skipped === 0 && summary.errors.length === 0 && summary.totalRows > 0,
  };
}

/** Build an existing-key set from a read-only production snapshot. */
export function existingKeySet(rows: { name: string; city: string; state: string }[]): Set<string> {
  return new Set(rows.map((r) => importDupKey(r.name, r.city, r.state)));
}

// ---------------------------------------------------------------------------
// Verified-date validation
// ---------------------------------------------------------------------------

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export type DateCheck = { value: string; ok: boolean; reason?: string };

/**
 * A verified date must be ISO YYYY-MM-DD, a real calendar date, and not in the
 * future relative to `todayIso` (passed in so this stays deterministic — no
 * clock access). Blank is allowed ONLY when `required` is false.
 */
export function validateVerifiedDate(
  value: string | null | undefined,
  todayIso: string,
  required = true,
): DateCheck {
  const v = (value ?? '').trim();
  if (!v) return { value: '', ok: !required, reason: required ? 'missing' : undefined };
  if (!ISO_DATE.test(v)) return { value: v, ok: false, reason: 'not-iso-yyyy-mm-dd' };
  // Real calendar date? Reconstruct and compare to reject 2026-02-31 etc.
  const [y, m, d] = v.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const roundtrip = `${dt.getUTCFullYear().toString().padStart(4, '0')}-${(dt.getUTCMonth() + 1)
    .toString()
    .padStart(2, '0')}-${dt.getUTCDate().toString().padStart(2, '0')}`;
  if (roundtrip !== v) return { value: v, ok: false, reason: 'not-a-real-date' };
  if (v > todayIso) return { value: v, ok: false, reason: 'in-the-future' };
  return { value: v, ok: true };
}

// ---------------------------------------------------------------------------
// Source-link shape validation (NO network)
// ---------------------------------------------------------------------------

export type LinkCheck = { raw: string; ok: boolean; reason?: string; normalized?: string };

/**
 * Validate a source link's SHAPE only. Accepts bare hosts/paths (the sources.md
 * convention writes "ta-petro.com/location/…" without a scheme) by prepending
 * https:// for the URL parse. Rejects non-http(s) schemes and obvious junk.
 * Does not confirm the page exists — that needs network the environment gates.
 */
export function validateSourceLink(raw: string): LinkCheck {
  const v = (raw ?? '').trim();
  if (!v) return { raw, ok: false, reason: 'empty' };
  const hasScheme = /^https?:\/\//i.test(v);
  // Reject any non-http(s) scheme outright (javascript:, data:, file:, …) so a
  // dangerous string can never be mistaken for a benign "named source".
  if (!hasScheme && /^[a-z][a-z0-9+.-]*:/i.test(v)) {
    return { raw, ok: false, reason: 'non-http-scheme' };
  }
  // Aggregator descriptions like "allstays.com Virginia truck stops" are prose,
  // not URLs — accept as a named source but flag as non-dereferenceable.
  const looksBareUrl = /^[a-z0-9.-]+\.[a-z]{2,}(\/\S*)?$/i.test(v);
  if (!hasScheme && !looksBareUrl) {
    return { raw, ok: true, reason: 'named-source-not-url' };
  }
  try {
    const u = new URL(hasScheme ? v : `https://${v}`);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') {
      return { raw, ok: false, reason: 'non-http-scheme' };
    }
    return { raw, ok: true, normalized: u.toString() };
  } catch {
    return { raw, ok: false, reason: 'malformed-url' };
  }
}

// ---------------------------------------------------------------------------
// Provenance file (sources.md) validation
// ---------------------------------------------------------------------------

export type ProvenanceEntry = {
  heading: string;
  verified?: string;
  source?: string;
  lineStart: number;
};

export type ProvenanceReport = {
  entryCount: number;
  entries: ProvenanceEntry[];
  missingVerified: string[];
  missingSource: string[];
  badDates: { heading: string; reason: string }[];
  badLinks: { heading: string; reason: string }[];
  ok: boolean;
};

/**
 * Parse a batch sources.md in the established convention: each listing is a
 * `### Heading` block containing `- **Verified:** YYYY-MM-DD` and
 * `- **Source:** …`. Reports any block missing a verified date or a source, and
 * validates every date and link's shape. Deterministic (takes `todayIso`).
 */
export function validateProvenanceFile(markdown: string, todayIso: string): ProvenanceReport {
  const lines = markdown.split(/\r?\n/);
  const entries: ProvenanceEntry[] = [];
  let current: ProvenanceEntry | null = null;

  const verifiedRe = /^\s*[-*]\s*\*\*Verified:\*\*\s*(.+?)\s*$/i;
  const sourceRe = /^\s*[-*]\s*\*\*Source:\*\*\s*(.+?)\s*$/i;

  lines.forEach((line, i) => {
    const h3 = /^###\s+(.*\S)\s*$/.exec(line);
    if (h3) {
      if (current) entries.push(current);
      current = { heading: h3[1], lineStart: i + 1 };
      return;
    }
    if (!current) return;
    const vm = verifiedRe.exec(line);
    if (vm) current.verified = vm[1].trim();
    const sm = sourceRe.exec(line);
    if (sm) current.source = sm[1].trim();
  });
  if (current) entries.push(current);

  const missingVerified: string[] = [];
  const missingSource: string[] = [];
  const badDates: { heading: string; reason: string }[] = [];
  const badLinks: { heading: string; reason: string }[] = [];

  for (const e of entries) {
    if (!e.verified) missingVerified.push(e.heading);
    else {
      const dc = validateVerifiedDate(e.verified, todayIso, true);
      if (!dc.ok) badDates.push({ heading: e.heading, reason: dc.reason ?? 'invalid' });
    }
    if (!e.source) missingSource.push(e.heading);
    else {
      // A source line may list several sources separated by ';' or ','.
      const parts = e.source
        .split(/[;]/)
        .map((s) => s.trim())
        .filter(Boolean);
      for (const p of parts) {
        const lc = validateSourceLink(p);
        if (!lc.ok) {
          badLinks.push({ heading: e.heading, reason: `${p}: ${lc.reason}` });
          break;
        }
      }
    }
  }

  return {
    entryCount: entries.length,
    entries,
    missingVerified,
    missingSource,
    badDates,
    badLinks,
    ok:
      entries.length > 0 &&
      missingVerified.length === 0 &&
      missingSource.length === 0 &&
      badDates.length === 0 &&
      badLinks.length === 0,
  };
}

/** Extract every source link from a provenance file, for a future network HEAD-check pass. */
export function extractSourceLinks(markdown: string, todayIso: string): string[] {
  const { entries } = validateProvenanceFile(markdown, todayIso);
  const links = new Set<string>();
  for (const e of entries) {
    if (!e.source) continue;
    for (const p of e.source
      .split(/[;]/)
      .map((s) => s.trim())
      .filter(Boolean)) {
      const lc = validateSourceLink(p);
      if (lc.ok && lc.normalized) links.add(lc.normalized);
    }
  }
  return [...links].sort();
}
