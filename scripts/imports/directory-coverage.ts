/**
 * Directory import COVERAGE + DEDUPE + INSERT-PLAN harness (pure, no I/O).
 *
 * This is analysis + planning ONLY. It never inserts, never opens a database
 * client, never touches the network. It reuses the canonical importer
 * (prepareImport, importDupKey, CANONICAL_IMPORT_COLUMNS, recognizeHeader) and
 * the shared duplicate/normalization/state vocabularies — it does not fork any
 * of them. A future, separately authorized step runs the emitted SQL after a
 * human reviews the plan.
 */
import { parseCsv } from '@/lib/directory/csv';
import { DIRECTORY_STATES } from '@/lib/directory/states';
import { normalizeText } from '@/lib/directory/duplicates';
import {
  importDupKey,
  prepareImport,
  CANONICAL_IMPORT_COLUMNS,
  recognizeHeader,
  type PreparedImport,
} from '@/lib/directory/import';

/** Minimal shape of a live production row for coverage/dedupe (read-only snapshot). */
export type ProductionRow = {
  id: string;
  name: string;
  city: string;
  state: string;
  type: string;
};

/** A parsed incoming batch row (already validated by prepareImport). */
export type IncomingRow = {
  name: string;
  city: string;
  state: string;
  type: string;
  lat: number | null;
  lng: number | null;
  verifiedAt: string | null;
};

// ---------------------------------------------------------------------------
// 32-column schema validation
// ---------------------------------------------------------------------------

export type SchemaHeaderCheck = {
  /** header cell → canonical field key */
  recognized: { header: string; field: string }[];
  /** header cells the importer would silently ignore */
  unknown: string[];
  /** canonical required columns absent from the header row */
  missingRequired: string[];
  /** raw headers that map to the same canonical field (collision) */
  duplicateFields: { field: string; headers: string[] }[];
  ok: boolean;
};

/** name + category are the only headers prepareImport hard-requires. */
const REQUIRED_FIELDS = ['name', 'category'];

/**
 * Validate a CSV's header row against the importer's own 32-column vocabulary.
 * Recognized headers are resolved through recognizeHeader (the importer's map),
 * so this can never drift from what prepareImport actually accepts.
 */
export function validateSchemaHeaders(csvText: string): SchemaHeaderCheck {
  const grid = parseCsv(csvText);
  const header = grid[0] ?? [];
  const recognized: { header: string; field: string }[] = [];
  const unknown: string[] = [];
  const fieldToHeaders = new Map<string, string[]>();

  for (const cell of header) {
    const field = recognizeHeader(cell);
    if (field == null) {
      unknown.push(cell);
      continue;
    }
    recognized.push({ header: cell, field });
    fieldToHeaders.set(field, [...(fieldToHeaders.get(field) ?? []), cell]);
  }

  const presentFields = new Set(recognized.map((r) => r.field));
  const missingRequired = REQUIRED_FIELDS.filter((f) => !presentFields.has(f));
  const duplicateFields = [...fieldToHeaders.entries()]
    .filter(([, headers]) => headers.length > 1)
    .map(([field, headers]) => ({ field, headers }));

  return {
    recognized,
    unknown,
    missingRequired,
    duplicateFields,
    ok: missingRequired.length === 0 && duplicateFields.length === 0,
  };
}

/** The canonical column list, for reporting/manifests. */
export const CANONICAL_COLUMNS = CANONICAL_IMPORT_COLUMNS;

// ---------------------------------------------------------------------------
// State coverage — always all 50 states + DC, even at zero
// ---------------------------------------------------------------------------

export type StateCoverageRow = {
  code: string;
  name: string;
  existing: number;
  incoming: number;
  projected: number;
};

/**
 * Per-state coverage across the full 50-states + DC registry. Rows with zero
 * coverage are still emitted (that is the point — the gaps are the story).
 * `incoming` counts NEW rows only (post-dedupe is the caller's job; pass the
 * insertable set to see the true projection).
 */
export function stateCoverageReport(
  existing: { state: string }[],
  incoming: { state: string }[] = [],
): StateCoverageRow[] {
  const tally = (rows: { state: string }[]) => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const s = (r.state ?? '').trim().toUpperCase();
      if (s) m.set(s, (m.get(s) ?? 0) + 1);
    }
    return m;
  };
  const ex = tally(existing);
  const inc = tally(incoming);

  return DIRECTORY_STATES.map((s) => {
    const e = ex.get(s.code) ?? 0;
    const i = inc.get(s.code) ?? 0;
    return { code: s.code, name: s.name, existing: e, incoming: i, projected: e + i };
  }).sort((a, b) => a.code.localeCompare(b.code));
}

/** States with no existing coverage — the expansion target list. */
export function uncoveredStates(existing: { state: string }[]): string[] {
  return stateCoverageReport(existing)
    .filter((r) => r.existing === 0)
    .map((r) => r.code);
}

// ---------------------------------------------------------------------------
// Dedupe: incoming vs production, and within the incoming batch
// ---------------------------------------------------------------------------

export type ExistingDupHit = {
  index: number;
  key: string;
  existingId: string;
  name: string;
  city: string;
  state: string;
};

/**
 * Which incoming rows collide with a live production row on the canonical
 * importDupKey (normalized name | city | STATE). These would be dropped as
 * duplicates by prepareImport — surfaced here so a human sees the overlap.
 */
export function existingDedupeCheck(
  incoming: IncomingRow[],
  existing: ProductionRow[],
): ExistingDupHit[] {
  const byKey = new Map<string, string>();
  for (const r of existing) byKey.set(importDupKey(r.name, r.city, r.state), r.id);

  const hits: ExistingDupHit[] = [];
  incoming.forEach((r, index) => {
    const key = importDupKey(r.name, r.city, r.state);
    const existingId = byKey.get(key);
    if (existingId) {
      hits.push({ index, key, existingId, name: r.name, city: r.city, state: r.state });
    }
  });
  return hits;
}

export type IncomingDupGroup = { key: string; indexes: number[] };

/** Duplicate importDupKeys WITHIN the incoming batch (first wins; rest are dups). */
export function incomingDedupeCheck(incoming: IncomingRow[]): IncomingDupGroup[] {
  const groups = new Map<string, number[]>();
  incoming.forEach((r, index) => {
    const key = importDupKey(r.name, r.city, r.state);
    groups.set(key, [...(groups.get(key) ?? []), index]);
  });
  return [...groups.entries()]
    .filter(([, idxs]) => idxs.length > 1)
    .map(([key, indexes]) => ({ key, indexes }));
}

// ---------------------------------------------------------------------------
// Cross-type same-name report
// ---------------------------------------------------------------------------

export type CrossTypeGroup = {
  normalizedName: string;
  entries: {
    source: 'existing' | 'incoming';
    id?: string;
    city: string;
    state: string;
    type: string;
  }[];
  types: string[];
};

/**
 * Same normalized business name appearing under more than one directory type
 * (e.g. a "Love's" listed as both truck-stops and parking). Not necessarily an
 * error — many real sites are multi-category — but always worth a human glance.
 */
export function crossTypeSameName(
  existing: ProductionRow[],
  incoming: IncomingRow[] = [],
): CrossTypeGroup[] {
  const byName = new Map<string, CrossTypeGroup['entries']>();
  const add = (name: string, entry: CrossTypeGroup['entries'][number]) => {
    const key = normalizeText(name);
    if (!key) return;
    byName.set(key, [...(byName.get(key) ?? []), entry]);
  };
  for (const r of existing)
    add(r.name, { source: 'existing', id: r.id, city: r.city, state: r.state, type: r.type });
  for (const r of incoming)
    add(r.name, { source: 'incoming', city: r.city, state: r.state, type: r.type });

  const out: CrossTypeGroup[] = [];
  for (const [normalizedName, entries] of byName) {
    const types = [...new Set(entries.map((e) => e.type))];
    if (types.length > 1) out.push({ normalizedName, entries, types });
  }
  return out.sort((a, b) => a.normalizedName.localeCompare(b.normalizedName));
}

// ---------------------------------------------------------------------------
// Blanks-where-unverified enforcement
// ---------------------------------------------------------------------------

export type UnverifiedCoordViolation = {
  index: number;
  name: string;
  state: string;
  reason: 'coordinate-without-verified-date';
};

/**
 * Enforce the manual-verification contract: a row may only carry lat/lng if it
 * also carries a verified date. A coordinate without provenance is refused —
 * this is the guard against invented coordinates entering a batch.
 */
export function blanksWhereUnverified(incoming: IncomingRow[]): UnverifiedCoordViolation[] {
  const out: UnverifiedCoordViolation[] = [];
  incoming.forEach((r, index) => {
    const hasCoord = r.lat != null || r.lng != null;
    if (hasCoord && !r.verifiedAt) {
      out.push({
        index,
        name: r.name,
        state: r.state,
        reason: 'coordinate-without-verified-date',
      });
    }
  });
  return out;
}

// ---------------------------------------------------------------------------
// Insert plan (DESIGN — emits SQL, never executes)
// ---------------------------------------------------------------------------

export type InsertPlanRow = Record<string, unknown> & { state?: string };

export type StateInsertPlan = {
  state: string;
  count: number;
  /** columns present, for the human reviewer */
  columns: string[];
  beforeCountSql: string;
  insertPreviewSql: string;
  rollbackSql: string;
};

function sqlStr(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

/**
 * Build a per-state INSERT plan from prepareImport()'s insertable rows. This is
 * insert-ONLY (never UPDATE — existing rows are never touched) and per-state
 * transactional: each state gets its own before-count, a preview of the insert,
 * and a slug-scoped rollback. Nothing here runs; a future authorized step does.
 */
export function buildInsertPlan(rows: InsertPlanRow[], batchLabel: string): StateInsertPlan[] {
  const byState = new Map<string, InsertPlanRow[]>();
  for (const r of rows) {
    const s = String(r.state ?? '').toUpperCase();
    byState.set(s, [...(byState.get(s) ?? []), r]);
  }

  const plans: StateInsertPlan[] = [];
  for (const state of [...byState.keys()].sort()) {
    const stateRows = byState.get(state) ?? [];
    const slugs = stateRows.map((r) => String(r.slug ?? '')).filter(Boolean);
    const slugList = slugs.map(sqlStr).join(', ');
    const columns = [...new Set(stateRows.flatMap((r) => Object.keys(r)))].sort();

    const beforeCountSql = `-- BEFORE count (${state})\nselect count(*) from public.locations where state=${sqlStr(state)} and deleted_at is null;`;

    // Insert is guarded: source stamps the batch, and every row is insert-only.
    // The real INSERT is generated by the server action from these rows; the
    // preview documents shape + the exact guard a reviewer must see.
    const insertPreviewSql = `-- INSERT (${state}, ${stateRows.length} rows) — INSERT-ONLY, do NOT run without separate authorization\n-- source stamped '${batchLabel}'. Never updates an existing row.\nbegin;\n-- one INSERT ... (col, ...) VALUES (...) per row, source='${batchLabel}'\n-- guard: none of these slugs may already exist for this state\ndo $$ begin if exists (select 1 from public.locations where state=${sqlStr(state)} and slug in (${slugList}) and deleted_at is null) then raise exception 'slug collision in ${state} — aborting insert'; end if; end $$;\ncommit;`;

    const rollbackSql = `-- ROLLBACK (${state}) — removes exactly this batch's inserted rows\nbegin;\ndelete from public.locations where source=${sqlStr(batchLabel)} and state=${sqlStr(state)} and slug in (${slugList});\ncommit;`;

    plans.push({
      state,
      count: stateRows.length,
      columns,
      beforeCountSql,
      insertPreviewSql,
      rollbackSql,
    });
  }
  return plans;
}

// ---------------------------------------------------------------------------
// Deterministic full-batch report (ties it together; still no I/O)
// ---------------------------------------------------------------------------

export type BatchCoverageReport = {
  prepared: PreparedImport;
  schema: SchemaHeaderCheck;
  existingDuplicates: ExistingDupHit[];
  incomingDuplicates: IncomingDupGroup[];
  crossType: CrossTypeGroup[];
  unverifiedCoords: UnverifiedCoordViolation[];
  coverage: StateCoverageRow[];
  insertPlan: StateInsertPlan[];
};

/**
 * One deterministic pass over a batch CSV: schema, prepareImport, dedupe (both
 * directions), cross-type, blanks-where-unverified, coverage, and the insert
 * plan. Same inputs → byte-identical output (no clock, no randomness).
 */
export function analyzeBatch(
  csvText: string,
  existing: ProductionRow[],
  incoming: IncomingRow[],
  batchLabel: string,
): BatchCoverageReport {
  const existingKeys = new Set(existing.map((r) => importDupKey(r.name, r.city, r.state)));
  const prepared = prepareImport(csvText, existingKeys);
  return {
    prepared,
    schema: validateSchemaHeaders(csvText),
    existingDuplicates: existingDedupeCheck(incoming, existing),
    incomingDuplicates: incomingDedupeCheck(incoming),
    crossType: crossTypeSameName(existing, incoming),
    unverifiedCoords: blanksWhereUnverified(incoming),
    coverage: stateCoverageReport(existing, prepared.rows as { state: string }[]),
    insertPlan: buildInsertPlan(prepared.rows as InsertPlanRow[], batchLabel),
  };
}
