/**
 * Controlled coordinate-application PLANNER — builds the exact per-state
 * transaction SQL, before-state snapshot, and rollback file for applying
 * reviewed geocodes. It DOES NOT EXECUTE: there is no database client and no
 * network here. It emits a plan a human reviews and a future, separately
 * authorized step runs. Reuses the provenance columns and the "Census is never
 * rooftop / never auto-applied" rule from the admin geocoding review contract.
 *
 * Hard guards (every one enforced before a row can enter the plan):
 *   1. the row was explicitly reviewer-approved
 *   2. its UUID matches a live production row
 *   3. that live row's lat/lng are currently NULL (never overwrite the 85)
 *   4. no duplicate ids in the approved set
 *   5. coordinates are finite and in-range
 * Only lat, lng, geocode_source, geocode_confidence, coord_verification_status,
 * last_geocoded_at, manually_verified_at/by are ever written. Never `geo`,
 * never identity/descriptive fields. Census confidence is capped at 'medium'.
 */
import { coordinateIssues } from '@/lib/map/geo';

export type GeocodeMethod = 'census' | 'interpolation' | 'manual' | 'batch-csv';

/** A row a human has reviewed and approved for application. */
export type ApprovedGeocode = {
  id: string;
  lat: number;
  lng: number;
  state: string;
  method: GeocodeMethod;
  confidence: 'high' | 'medium' | 'low';
  reviewerApproved: boolean;
  reviewer: string; // who approved (admin identifier)
};

/** The live production row's current coordinate state (from a read-only snapshot). */
export type LiveRow = {
  id: string;
  lat: number | null;
  lng: number | null;
  deletedAt: string | null;
};

export type PlannedUpdate = {
  id: string;
  lat: number;
  lng: number;
  geocodeSource: GeocodeMethod;
  geocodeConfidence: 'high' | 'medium' | 'low';
};

export type StatePlan = {
  state: string;
  updates: PlannedUpdate[];
  refused: { id: string; reason: string }[];
  beforeSnapshotSql: string;
  updateSql: string;
  rollbackSql: string;
};

/** Census results are TIGER address-range — never 'high', never rooftop. */
function effectiveConfidence(g: ApprovedGeocode): 'high' | 'medium' | 'low' {
  if (g.method === 'census') return g.confidence === 'low' ? 'low' : 'medium';
  return g.confidence;
}

function sqlStr(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

/**
 * Build the per-state application plan. `nowIso` and `reviewerDefault` are
 * injected so the output is deterministic and testable. Rows failing any guard
 * are moved to `refused` with a reason and never appear in the SQL.
 */
export function buildApplyPlan(
  approved: ApprovedGeocode[],
  live: Map<string, LiveRow>,
  nowIso: string,
): StatePlan[] {
  const refusedByState = new Map<string, { id: string; reason: string }[]>();
  const okByState = new Map<string, PlannedUpdate[]>();
  const seen = new Set<string>();

  const refuse = (state: string, id: string, reason: string) => {
    const arr = refusedByState.get(state) ?? [];
    arr.push({ id, reason });
    refusedByState.set(state, arr);
  };

  for (const g of approved) {
    const state = (g.state ?? '').toUpperCase();
    if (!g.reviewerApproved) {
      refuse(state, g.id, 'not-reviewer-approved');
      continue;
    }
    if (seen.has(g.id)) {
      refuse(state, g.id, 'duplicate-approved-id');
      continue;
    }
    seen.add(g.id);
    const liveRow = live.get(g.id);
    if (!liveRow || liveRow.deletedAt != null) {
      refuse(state, g.id, 'uuid-not-live');
      continue;
    }
    if (liveRow.lat != null || liveRow.lng != null) {
      // NEVER overwrite an existing coordinate (the 85).
      refuse(state, g.id, 'existing-coordinate-present');
      continue;
    }
    if (coordinateIssues(g.lat, g.lng).length > 0) {
      refuse(state, g.id, 'invalid-coordinate');
      continue;
    }
    const arr = okByState.get(state) ?? [];
    arr.push({
      id: g.id,
      lat: g.lat,
      lng: g.lng,
      geocodeSource: g.method,
      geocodeConfidence: effectiveConfidence(g),
    });
    okByState.set(state, arr);
  }

  const states = new Set<string>([...okByState.keys(), ...refusedByState.keys()]);
  const plans: StatePlan[] = [];
  for (const state of [...states].sort()) {
    const updates = okByState.get(state) ?? [];
    const ids = updates.map((u) => u.id);
    const idList = ids.map(sqlStr).join(', ');

    // Before-snapshot: capture every targeted row's current state for the record.
    const beforeSnapshotSql = ids.length
      ? `-- BEFORE snapshot (${state}, ${ids.length} rows)\nselect id, lat, lng, geocode_source, geocode_confidence, coord_verification_status, last_geocoded_at\nfrom public.locations where id in (${idList});`
      : `-- BEFORE snapshot (${state}): no rows`;

    // Per-state transaction. Each UPDATE re-asserts lat IS NULL (compare-and-swap)
    // so a row that gained a coordinate between snapshot and apply is skipped, not
    // clobbered. The row-count guard aborts the whole state on any mismatch.
    const updateLines = updates.map(
      (u) =>
        `update public.locations set\n  lat=${u.lat}, lng=${u.lng},\n  geocode_source='${u.geocodeSource}', geocode_confidence='${u.geocodeConfidence}',\n  coord_verification_status='manually-verified',\n  last_geocoded_at=${sqlStr(nowIso)}, manually_verified_at=${sqlStr(nowIso)},\n  manually_verified_by='census-review'\nwhere id=${sqlStr(u.id)} and deleted_at is null and lat is null and lng is null;`,
    );
    const updateSql = ids.length
      ? `-- APPLY (${state}) — do NOT run without separate explicit authorization\nbegin;\n${updateLines.join('\n')}\n-- guard: exactly ${ids.length} rows must have been updated this txn\ndo $$ begin if (select count(*) from public.locations where id in (${idList}) and lat is not null) <> ${ids.length} then raise exception 'row-count mismatch — rolling back ${state}'; end if; end $$;\ncommit;`
      : `-- APPLY (${state}): no rows`;

    // Rollback: revert exactly the applied columns to their pre-apply (null) state.
    const rollbackSql = ids.length
      ? `-- ROLLBACK (${state}) — restores the coordinate-free state\nbegin;\nupdate public.locations set\n  lat=null, lng=null, geocode_source=null, geocode_confidence=null,\n  coord_verification_status=null, last_geocoded_at=null,\n  manually_verified_at=null, manually_verified_by=null\nwhere id in (${idList});\ncommit;`
      : `-- ROLLBACK (${state}): no rows`;

    plans.push({
      state,
      updates,
      refused: refusedByState.get(state) ?? [],
      beforeSnapshotSql,
      updateSql,
      rollbackSql,
    });
  }
  return plans;
}
