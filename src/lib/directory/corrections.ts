import { z } from 'zod';
import { parseCsv, toCsv, safeCsvCell, unguardCsvCell } from './csv';
import { validateTpcUrl } from './tpc';
import { CATEGORY_SLUGS, dbTypeFor } from './admin';
import { AMENITIES } from './amenities';

/**
 * Generalized safe bulk-correction pipeline (Milestone 21). Pure parse →
 * identity cross-check → per-field validation → change-set diff. Only fields
 * on the explicit allowlist below can EVER be touched; publication status,
 * moderation, ownership, and internal fields have no path through here.
 *
 * Cell semantics (documented on the admin page and in the template):
 *   - empty cell            → NO CHANGE (fields not in the CSV are never touched either)
 *   - the literal __CLEAR__ → blank the field (flagged as destructive)
 *   - any other value       → proposed new value (validated per field)
 *
 * Identity: `listing_id` is the key, and `match_city` + `match_state` (plus
 * `match_name`, all reflecting CURRENT values) must agree with the live row —
 * an id with mismatched identity is rejected, never "probably fine".
 */

export const CLEAR_TOKEN = '__CLEAR__';

export const IDENTITY_COLUMNS = ['listing_id', 'match_name', 'match_city', 'match_state'] as const;

const state2 = z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, 'must be a 2-letter code');
const httpUrl = z
  .string()
  .trim()
  .max(300)
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  }, 'must be a full http(s):// URL');

/** Yes/no cell for the four parking flags. */
const yesNo = z
  .string()
  .trim()
  .toLowerCase()
  .refine((v) => ['yes', 'no', 'true', 'false', 'y', 'n'].includes(v), 'must be yes or no');
const yesNoToBool = (v: string) => ['yes', 'true', 'y'].includes(v.trim().toLowerCase());

type FieldSpec = {
  /** CSV column name. */
  column: string;
  /** locations column the change writes to. */
  dbColumn: string;
  label: string;
  /** Validate a NON-empty, non-CLEAR cell; return an error string or null. */
  validate: (value: string) => string | null;
  /** Convert a valid cell to the DB value. */
  toDb: (value: string) => unknown;
  /** May the field be cleared with __CLEAR__? */
  clearable: boolean;
  /** DB value when cleared. */
  clearValue?: unknown;
};

const zodCheck = (schema: z.ZodTypeAny) => (value: string) => {
  const r = schema.safeParse(value);
  return r.success ? null : r.error.issues[0].message;
};

/** THE allowlist. Nothing outside this table can be modified by a correction CSV. */
export const CORRECTION_FIELDS: FieldSpec[] = [
  { column: 'name', dbColumn: 'name', label: 'Name', validate: zodCheck(z.string().trim().min(2).max(120)), toDb: (v) => v.trim(), clearable: false },
  { column: 'address', dbColumn: 'address', label: 'Address', validate: zodCheck(z.string().trim().max(200)), toDb: (v) => v.trim(), clearable: true, clearValue: null },
  { column: 'city', dbColumn: 'city', label: 'City', validate: zodCheck(z.string().trim().min(1).max(80)), toDb: (v) => v.trim(), clearable: false },
  { column: 'state', dbColumn: 'state', label: 'State', validate: zodCheck(state2), toDb: (v) => v.trim().toUpperCase(), clearable: false },
  { column: 'zip', dbColumn: 'zip', label: 'ZIP', validate: zodCheck(z.string().trim().regex(/^\d{5}(-\d{4})?$/, 'ZIP must be 12345 or 12345-6789')), toDb: (v) => v.trim(), clearable: true, clearValue: null },
  { column: 'phone', dbColumn: 'phone', label: 'Phone', validate: zodCheck(z.string().trim().max(30).regex(/^[0-9()+.\-\s ext]*$/i, 'digits and ()+-. only')), toDb: (v) => v.trim(), clearable: true, clearValue: null },
  { column: 'website', dbColumn: 'website', label: 'Website', validate: zodCheck(httpUrl), toDb: (v) => v.trim(), clearable: true, clearValue: null },
  {
    column: 'category',
    dbColumn: 'category_slug',
    label: 'Category',
    validate: (v) => ((CATEGORY_SLUGS as string[]).includes(v.trim()) ? null : `unknown category "${v.trim()}"`),
    toDb: (v) => v.trim(),
    clearable: false,
  },
  { column: 'interstate', dbColumn: 'interstate', label: 'Interstate', validate: zodCheck(z.string().trim().max(20)), toDb: (v) => v.trim(), clearable: true, clearValue: null },
  { column: 'exit_number', dbColumn: 'exit_number', label: 'Exit number', validate: zodCheck(z.string().trim().max(20)), toDb: (v) => v.trim(), clearable: true, clearValue: null },
  { column: 'description', dbColumn: 'description', label: 'Description', validate: zodCheck(z.string().trim().max(2000)), toDb: (v) => v.trim(), clearable: true, clearValue: null },
  { column: 'free_parking', dbColumn: 'free_parking', label: 'Free parking', validate: zodCheck(yesNo), toDb: yesNoToBool, clearable: false },
  { column: 'paid_parking', dbColumn: 'paid_parking', label: 'Paid parking', validate: zodCheck(yesNo), toDb: yesNoToBool, clearable: false },
  { column: 'reserved_parking', dbColumn: 'reserved_parking', label: 'Reserved parking', validate: zodCheck(yesNo), toDb: yesNoToBool, clearable: false },
  { column: 'overnight_parking', dbColumn: 'overnight_parking', label: 'Overnight parking', validate: zodCheck(yesNo), toDb: yesNoToBool, clearable: false },
  { column: 'parking_spaces', dbColumn: 'parking_spaces', label: 'Truck spaces', validate: zodCheck(z.coerce.number().int().min(0).max(10000)), toDb: (v) => Number(v), clearable: true, clearValue: null },
  {
    column: 'amenities',
    dbColumn: 'amenities',
    label: 'Amenities',
    validate: (v) => {
      const items = v.split('|').map((a) => a.trim()).filter(Boolean);
      const bad = items.filter((a) => !(AMENITIES as readonly string[]).includes(a));
      return bad.length === 0 ? null : `unknown amenity: ${bad.join(', ')}`;
    },
    toDb: (v) => v.split('|').map((a) => a.trim()).filter(Boolean),
    clearable: true,
    clearValue: [],
  },
  {
    column: 'tpc_url',
    dbColumn: 'tpc_url',
    label: 'TPC URL',
    validate: (v) => {
      const r = validateTpcUrl(v);
      return r.ok ? null : r.reason;
    },
    toDb: (v) => (validateTpcUrl(v) as { normalized: string }).normalized,
    clearable: true,
    clearValue: null,
  },
  {
    column: 'verified_on',
    dbColumn: 'verified_at',
    label: 'Verified date',
    validate: zodCheck(z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, 'use YYYY-MM-DD')),
    toDb: (v) => new Date(`${v.trim()}T00:00:00Z`).toISOString(),
    clearable: true,
    clearValue: null,
  },
];

const FIELD_BY_COLUMN = new Map(CORRECTION_FIELDS.map((f) => [f.column, f]));

/** Everything a correction can compare against / write to. */
export type CorrectionLiveRow = {
  id: string;
  name: string;
  city: string;
  state: string;
  /** Current DB values keyed by dbColumn (arrays already arrays). */
  values: Record<string, unknown>;
};

export type CorrectionChange = {
  column: string;
  label: string;
  dbColumn: string;
  from: unknown;
  to: unknown;
  /** A non-empty value is being removed. */
  blanking: boolean;
};

export type CorrectionRowProblem =
  | 'unknown-listing-id'
  | 'duplicate-listing-id'
  | 'identity-mismatch'
  | 'invalid-value'
  | 'no-changes';

export type ValidatedCorrectionRow = {
  listingId: string;
  matchName: string;
  liveName: string | null;
  city: string;
  state: string;
  applicable: boolean;
  problems: CorrectionRowProblem[];
  problemDetails: string[];
  changes: CorrectionChange[];
  hasBlanking: boolean;
};

export type CorrectionsParseResult =
  | { ok: false; errors: string[] }
  | { ok: true; editableColumns: string[]; rows: Record<string, string>[]; warnings: string[] };

export const CORRECTIONS_MAX_ROWS = 2000;

/** Header validation + raw row extraction. Unknown columns are fatal. */
export function parseCorrectionsCsv(text: string): CorrectionsParseResult {
  const table = parseCsv(text);
  if (table.length === 0) return { ok: false, errors: ['The file is empty.'] };
  if (table.length - 1 > CORRECTIONS_MAX_ROWS) {
    return { ok: false, errors: [`Too many rows (${table.length - 1}; max ${CORRECTIONS_MAX_ROWS}).`] };
  }

  const header = table[0].map((h) => h.trim().toLowerCase());
  const errors: string[] = [];
  for (const required of IDENTITY_COLUMNS) {
    if (!header.includes(required)) errors.push(`Missing required column: ${required}`);
  }
  const unknown = header.filter(
    (h) => !(IDENTITY_COLUMNS as readonly string[]).includes(h) && !FIELD_BY_COLUMN.has(h),
  );
  if (unknown.length > 0) {
    errors.push(
      `Unsupported column(s): ${unknown.join(', ')}. Only the documented safe fields can be corrected.`,
    );
  }
  const editableColumns = header.filter((h) => FIELD_BY_COLUMN.has(h));
  if (editableColumns.length === 0) errors.push('The file has no editable field columns.');
  if (errors.length > 0) return { ok: false, errors };

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < table.length; i++) {
    const raw = table[i];
    if (raw.every((c) => c.trim() === '')) continue;
    const record: Record<string, string> = {};
    header.forEach((h, col) => {
      record[h] = unguardCsvCell(raw[col] ?? '');
    });
    rows.push(record);
  }
  return { ok: true, editableColumns, rows, warnings: [] };
}

const norm = (s: string | null | undefined) =>
  (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

const isBlankish = (v: unknown) =>
  v == null || v === '' || (Array.isArray(v) && v.length === 0);

function valuesEqual(a: unknown, b: unknown): boolean {
  if (Array.isArray(a) || Array.isArray(b)) {
    const aa = Array.isArray(a) ? a : [];
    const bb = Array.isArray(b) ? b : [];
    return aa.length === bb.length && aa.every((v, i) => v === bb[i]);
  }
  if (isBlankish(a) && isBlankish(b)) return true;
  return a === b;
}

/**
 * The dry-run core: cross-check identity, validate every provided cell,
 * and produce the exact change set an apply would write. Pure — usable in
 * CI/tests with fixture data and by the server action with live data.
 */
export function validateCorrections(
  rows: Record<string, string>[],
  editableColumns: string[],
  live: Map<string, CorrectionLiveRow>,
): ValidatedCorrectionRow[] {
  const seen = new Map<string, number>();
  for (const r of rows) {
    const id = (r.listing_id ?? '').trim();
    seen.set(id, (seen.get(id) ?? 0) + 1);
  }

  return rows.map((raw) => {
    const listingId = (raw.listing_id ?? '').trim();
    const problems: CorrectionRowProblem[] = [];
    const problemDetails: string[] = [];
    const liveRow = live.get(listingId) ?? null;

    if ((seen.get(listingId) ?? 0) > 1) {
      problems.push('duplicate-listing-id');
      problemDetails.push('listing_id appears more than once in the file');
    }
    if (!liveRow) {
      problems.push('unknown-listing-id');
      problemDetails.push('no live listing with this id');
    } else {
      const nameOk = norm(liveRow.name) === norm(raw.match_name);
      const cityOk = norm(liveRow.city) === norm(raw.match_city);
      const stateOk = norm(liveRow.state) === norm(raw.match_state);
      if (!nameOk || !cityOk || !stateOk) {
        problems.push('identity-mismatch');
        problemDetails.push(
          `match columns say "${raw.match_name} — ${raw.match_city}, ${raw.match_state}" but the ` +
            `live listing is "${liveRow.name} — ${liveRow.city}, ${liveRow.state}"`,
        );
      }
    }

    const changes: CorrectionChange[] = [];
    for (const column of editableColumns) {
      const spec = FIELD_BY_COLUMN.get(column)!;
      const cell = (raw[column] ?? '').trim();
      if (cell === '') continue; // empty = no change, always

      const from = liveRow ? liveRow.values[spec.dbColumn] : undefined;
      if (cell === CLEAR_TOKEN) {
        if (!spec.clearable) {
          problems.push('invalid-value');
          problemDetails.push(`${spec.label} cannot be cleared`);
          continue;
        }
        if (liveRow && isBlankish(from)) continue; // already blank — no change
        changes.push({
          column,
          label: spec.label,
          dbColumn: spec.dbColumn,
          from: from ?? null,
          to: spec.clearValue ?? null,
          blanking: true,
        });
        continue;
      }

      const invalid = spec.validate(cell);
      if (invalid) {
        problems.push('invalid-value');
        problemDetails.push(`${spec.label}: ${invalid}`);
        continue;
      }
      const to = spec.toDb(cell);
      if (liveRow && valuesEqual(from, to)) continue; // no-op
      changes.push({
        column,
        label: spec.label,
        dbColumn: spec.dbColumn,
        from: from ?? null,
        to,
        blanking: false,
      });
    }

    if (changes.length === 0 && problems.length === 0) {
      problems.push('no-changes');
      problemDetails.push('every provided value already matches the live listing');
    }

    return {
      listingId,
      matchName: raw.match_name ?? '',
      liveName: liveRow?.name ?? null,
      city: liveRow?.city ?? raw.match_city ?? '',
      state: liveRow?.state ?? raw.match_state ?? '',
      applicable: problems.length === 0 && changes.length > 0,
      problems,
      problemDetails,
      changes,
      hasBlanking: changes.some((c) => c.blanking),
    };
  });
}

/**
 * The DB patch for one validated row — ONLY the diffed columns, plus the
 * legacy `type` column when the category changes (kept in lockstep the same
 * way the admin editor does).
 */
export function correctionPatch(row: ValidatedCorrectionRow): Record<string, unknown> {
  const patch: Record<string, unknown> = {};
  for (const change of row.changes) {
    patch[change.dbColumn] = change.to;
    if (change.dbColumn === 'category_slug' && typeof change.to === 'string') {
      patch.type = dbTypeFor(change.to);
    }
  }
  return patch;
}

/** history payload (from → to per changed column). */
export function correctionChangedFields(
  row: ValidatedCorrectionRow,
): Record<string, { from: unknown; to: unknown }> {
  return Object.fromEntries(
    row.changes.map((c) => [c.dbColumn, { from: c.from ?? null, to: c.to ?? null }]),
  );
}

/** Blank template CSV for the docs/download (identity + all editable columns). */
export function correctionsTemplateCsv(): string {
  return toCsv([[...IDENTITY_COLUMNS, ...CORRECTION_FIELDS.map((f) => f.column)]]);
}

/** Failure report for download after an apply. */
export function correctionFailuresCsv(
  failures: { id: string; name: string; error: string }[],
): string {
  return toCsv([
    ['listing_id', 'name', 'error'],
    ...failures.map((f) => [f.id, safeCsvCell(f.name), safeCsvCell(f.error)]),
  ]);
}
