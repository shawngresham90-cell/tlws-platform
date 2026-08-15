/**
 * The Stan Store marketing export — the shape of the file, and the rules
 * about who may appear in it.
 *
 * Pure. Rows arrive as an argument, the CSV comes back as a string, and the
 * clock is passed in. That is what lets the harness prove the consent
 * filtering exhaustively without a database, which matters because the
 * failure this file exists to prevent is not a crash — it is one address in a
 * marketing list that never agreed to be there.
 *
 * WHO IS IN THE FILE IS NOT DECIDED HERE. It is decided by
 * `public.navigator_marketing_contacts`, which joins identity to append-only
 * consent evidence and filters to `is_subscribed`. This module receives rows
 * that already passed that filter and does NOT re-derive the rule — two
 * copies of a consent rule can disagree, and the moment they do there is no
 * way to tell which one a given export actually used.
 *
 * What this module DOES enforce is the second line of defence: a row with no
 * usable address is dropped, and one person cannot appear twice.
 */

/** A row as the marketing view hands it over. */
export type MarketingContactRow = {
  first_name: string | null;
  email: string | null;
  phone: string | null;
  phone_e164: string | null;
  created_at: string;
};

/**
 * Stan's importer maps on these four headers. Last Name is present and
 * always empty: the Navigator collects a first name only, and an importer
 * that expects the column is better served by a blank one than by a missing
 * one.
 */
export const STAN_CSV_HEADERS = ['First Name', 'Last Name', 'Email', 'Phone'] as const;

/**
 * Stan's documented manual-import ceiling, per store.
 *
 * Quoted here so the export can warn BEFORE a file is handed to an importer
 * that will silently take the first N rows. If Stan changes it, this constant
 * and the operations note move together.
 */
export const STAN_MANUAL_IMPORT_LIMIT = 5000;

function csvCell(value: string): string {
  // RFC-4180: quote when the cell contains a comma, quote, CR or LF.
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export type StanExportResult = {
  csv: string;
  /** Rows actually written, after dropping unusable and duplicate addresses. */
  included: number;
  /** Dropped for having no usable email. Reported, never silent. */
  droppedNoEmail: number;
  /** Dropped as a repeat of an address already written. */
  droppedDuplicate: number;
  /** True when the file exceeds what Stan will accept in one import. */
  overStanLimit: boolean;
};

/**
 * Build the CSV.
 *
 * DE-DUPLICATION IS BY NORMALIZED ADDRESS, and it keeps the FIRST occurrence.
 * The view is ordered oldest-first by the caller, so "first" means the
 * earliest signup — which is the row whose consent evidence is the one that
 * has been standing longest. Keeping the newest instead would be equally
 * defensible and is not what this does; the choice is recorded so it is not
 * silently reversed later.
 *
 * A row with no email is dropped rather than written blank: a contact record
 * with no address is not importable, and a blank line in a marketing file is
 * how a count stops matching a list.
 */
export function buildStanCsv(rows: readonly MarketingContactRow[]): StanExportResult {
  const seen = new Set<string>();
  const lines: string[] = [STAN_CSV_HEADERS.join(',')];
  let droppedNoEmail = 0;
  let droppedDuplicate = 0;

  for (const row of rows) {
    const email = (row.email ?? '').trim().toLowerCase();
    if (email === '' || !email.includes('@')) {
      droppedNoEmail++;
      continue;
    }
    if (seen.has(email)) {
      droppedDuplicate++;
      continue;
    }
    seen.add(email);

    lines.push(
      [
        csvCell((row.first_name ?? '').trim()),
        // Always blank. The column exists for Stan's mapper, not for data.
        '',
        csvCell(email),
        // Prefer the normalized form: an importer matching on phone needs one
        // spelling, and "(555) 123-4567" and "+15551234567" are two.
        csvCell((row.phone_e164 ?? row.phone ?? '').trim()),
      ].join(','),
    );
  }

  return {
    csv: `${lines.join('\r\n')}\r\n`,
    included: seen.size,
    droppedNoEmail,
    droppedDuplicate,
    overStanLimit: seen.size > STAN_MANUAL_IMPORT_LIMIT,
  };
}

/**
 * Parse the optional `since` filter.
 *
 * Returns null for absent OR unparseable input, and null means "no filter" —
 * i.e. export everyone. That is the safe direction for this particular
 * parameter: a misread date that silently narrowed the export would produce a
 * file that looks complete and quietly omits people, which is far harder to
 * notice than one that includes more than expected.
 */
export function parseSince(raw: string | null | undefined): string | null {
  const value = (raw ?? '').trim();
  if (value === '') return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

/** Filename carrying the window, so two downloads are never confused. */
export function stanExportFilename(sinceIso: string | null, nowIso: string): string {
  const day = (iso: string) => iso.slice(0, 10);
  return sinceIso === null
    ? `tlws-navigator-marketing-all-${day(nowIso)}.csv`
    : `tlws-navigator-marketing-since-${day(sinceIso)}-${day(nowIso)}.csv`;
}
