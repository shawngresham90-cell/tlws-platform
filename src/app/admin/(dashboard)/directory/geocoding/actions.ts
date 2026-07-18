'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { MODERATION_ADMIN } from '@/lib/admin/community';
import { recordHistory } from '@/lib/admin/history';
import {
  parseGeocodingCsv,
  validateBatch,
  type LiveListingRef,
  type ValidatedRow,
} from '@/lib/directory/geocoding';
import {
  proposalMethod,
  geocodeSourceForMethod,
  isStaleReview,
} from '@/lib/directory/review-enrichment';

/**
 * Admin geocoding writes (Milestone 17). Preview never writes. Apply
 * re-parses and re-validates the CSV server-side (the client's view is never
 * trusted), applies ONLY selected rows that are action=ready +
 * confidence=high + valid, refuses to overwrite an existing coordinate
 * without an explicit per-row confirmation, and writes a location_history
 * row (source 'geocoding') BEFORE each coordinate update — a failed history
 * write aborts that row's update.
 */

const MAX_CSV_BYTES = 2 * 1024 * 1024;

async function getLiveRefs(): Promise<Map<string, LiveListingRef>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('locations')
    .select('id, name, address, city, state, lat, lng, interstate')
    .is('deleted_at', null)
    .limit(5000);
  if (error || !data) throw new Error(error?.message ?? 'Could not load live listings');
  return new Map((data as unknown as LiveListingRef[]).map((r) => [r.id, r]));
}

function readCsvText(formData: FormData): { text?: string; error?: string } {
  const text = formData.get('csv_text');
  if (typeof text !== 'string' || text.trim() === '') {
    return { error: 'Choose a geocoding CSV first.' };
  }
  if (text.length > MAX_CSV_BYTES) return { error: 'File too large (max 2 MB).' };
  return { text };
}

export type GeocodingPreviewState = {
  error: string | null;
  fileErrors: string[];
  rows: ValidatedRow[] | null;
};

export async function previewGeocodingAction(
  _prev: GeocodingPreviewState,
  formData: FormData,
): Promise<GeocodingPreviewState> {
  requireAdmin();
  const { text, error } = readCsvText(formData);
  if (error || !text) return { error: error ?? 'No file.', fileErrors: [], rows: null };

  const parsed = parseGeocodingCsv(text);
  if (parsed.rows.length === 0) {
    return {
      error: 'No valid rows found in the file.',
      fileErrors: parsed.errors,
      rows: null,
    };
  }
  try {
    const live = await getLiveRefs();
    return { error: null, fileErrors: parsed.errors, rows: validateBatch(parsed.rows, live) };
  } catch (e) {
    return { error: (e as Error).message, fileErrors: parsed.errors, rows: null };
  }
}

export type GeocodingApplyState = {
  error: string | null;
  applied: number;
  skipped: number;
  failures: { id: string; name: string; error: string }[];
  done: boolean;
};

export async function applyGeocodingAction(
  _prev: GeocodingApplyState,
  formData: FormData,
): Promise<GeocodingApplyState> {
  requireAdmin();
  const fail = (error: string): GeocodingApplyState => ({
    error,
    applied: 0,
    skipped: 0,
    failures: [],
    done: false,
  });

  const { text, error } = readCsvText(formData);
  if (error || !text) return fail(error ?? 'No file.');

  let selected: string[];
  let overwriteConfirmed: string[];
  try {
    selected = JSON.parse(String(formData.get('selected') ?? '[]'));
    overwriteConfirmed = JSON.parse(String(formData.get('overwrite_confirmed') ?? '[]'));
    if (!Array.isArray(selected) || !Array.isArray(overwriteConfirmed)) throw new Error();
  } catch {
    return fail('Invalid selection payload.');
  }
  if (selected.length === 0) return fail('Select at least one row to apply.');

  const parsed = parseGeocodingCsv(text);
  let rows: ValidatedRow[];
  try {
    rows = validateBatch(parsed.rows, await getLiveRefs());
  } catch (e) {
    return fail((e as Error).message);
  }
  const byId = new Map(rows.map((r) => [r.listing_id, r]));
  const confirmedOverwrites = new Set(overwriteConfirmed.map(String));

  const supabase = createAdminClient();
  let applied = 0;
  let skipped = 0;
  const failures: GeocodingApplyState['failures'] = [];

  for (const id of selected.map(String)) {
    const row = byId.get(id);
    if (!row) {
      failures.push({ id, name: id, error: 'Selected row not found in the uploaded file.' });
      continue;
    }
    // Server-side gate: never trust the client's idea of applicability.
    if (!row.applicable || row.proposed_latitude == null || row.proposed_longitude == null) {
      skipped += 1;
      continue;
    }
    if (row.wouldOverwrite && !confirmedOverwrites.has(id)) {
      failures.push({
        id,
        name: row.business_name,
        error: 'Existing coordinates would be overwritten — needs explicit confirmation.',
      });
      continue;
    }
    // Stale-review protection: the reviewer approved against the batch
    // file's current_* coordinates. If the live row's coordinates changed
    // since the batch was generated, that approval no longer applies.
    if (isStaleReview(row.current_latitude, row.current_longitude, row.live?.lat, row.live?.lng)) {
      failures.push({
        id,
        name: row.business_name,
        error:
          'Stale review: live coordinates changed after this batch was generated — regenerate and re-review.',
      });
      continue;
    }

    // History BEFORE the coordinate write; failure aborts this row.
    const method = proposalMethod(row);
    const historyError = await recordHistory(supabase, {
      location_id: id,
      source: 'geocoding',
      admin: MODERATION_ADMIN,
      changed_fields: {
        lat: { from: row.live?.lat ?? null, to: row.proposed_latitude },
        lng: { from: row.live?.lng ?? null, to: row.proposed_longitude },
      },
      note:
        `Geocoding batch apply (confidence ${row.confidence}, method ${method}). Source: ` +
        `${row.source_url || 'n/a'}. ${row.verification_notes}`.slice(0, 500),
    });
    if (historyError) {
      failures.push({
        id,
        name: row.business_name,
        error: `History write failed: ${historyError}`,
      });
      continue;
    }

    const now = new Date().toISOString();
    // Compare-and-swap: the update only matches if the row still carries the
    // coordinates this review was validated against, so two concurrent tabs
    // cannot both win. Zero matched rows = concurrent change or soft-delete —
    // reported as a failure, never as success.
    let update = supabase
      .from('locations')
      .update({
        lat: row.proposed_latitude,
        lng: row.proposed_longitude,
        // Provenance (migration 043): what produced this coordinate, how
        // confident the producer was, and that an admin signed off on it.
        geocode_source: geocodeSourceForMethod(method),
        geocode_confidence:
          row.confidence === 'high' ? 'high' : row.confidence === 'medium' ? 'medium' : 'low',
        coord_verification_status: 'manually-verified',
        last_geocoded_at: now,
        manually_verified_at: now,
        manually_verified_by: MODERATION_ADMIN,
      })
      .eq('id', id)
      .is('deleted_at', null);
    update = row.live?.lat == null ? update.is('lat', null) : update.eq('lat', row.live.lat);
    update = row.live?.lng == null ? update.is('lng', null) : update.eq('lng', row.live.lng);
    const { data: updatedRows, error: updateError } = await update.select('id');
    if (updateError) {
      failures.push({ id, name: row.business_name, error: updateError.message });
      continue;
    }
    if (!updatedRows || updatedRows.length === 0) {
      failures.push({
        id,
        name: row.business_name,
        error:
          'Not applied: the listing changed (or was removed) while this review was open. ' +
          'The audit entry records an aborted attempt — regenerate and re-review.',
      });
      continue;
    }
    applied += 1;
  }

  if (applied > 0) {
    revalidatePath('/admin/directory');
    revalidatePath('/directory');
  }
  return { error: null, applied, skipped, failures, done: true };
}

/* ============================================================== rollback */

export type GeocodingHistoryItem = {
  id: string;
  location_id: string;
  location_name: string;
  admin: string;
  created_at: string;
  from: { lat: number | null; lng: number | null };
  to: { lat: number | null; lng: number | null };
  note: string;
};

type CoordChange = { from?: number | null; to?: number | null } | undefined;

/** Recent geocoding applies, newest first — the rollback surface's data. */
export async function listGeocodingHistoryAction(): Promise<{
  error: string | null;
  items: GeocodingHistoryItem[];
}> {
  requireAdmin();
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('location_history')
    .select('id, location_id, admin, created_at, changed_fields, note, locations(name)')
    .eq('source', 'geocoding')
    .order('created_at', { ascending: false })
    .limit(25);
  if (error || !data) return { error: error?.message ?? 'Could not load history', items: [] };
  const items = (
    data as unknown as {
      id: string;
      location_id: string;
      admin: string;
      created_at: string;
      changed_fields: { lat?: CoordChange; lng?: CoordChange };
      note: string | null;
      locations: { name: string } | null;
    }[]
  ).map((h) => ({
    id: h.id,
    location_id: h.location_id,
    location_name: h.locations?.name ?? h.location_id,
    admin: h.admin,
    created_at: h.created_at,
    from: { lat: h.changed_fields?.lat?.from ?? null, lng: h.changed_fields?.lng?.from ?? null },
    to: { lat: h.changed_fields?.lat?.to ?? null, lng: h.changed_fields?.lng?.to ?? null },
    note: h.note ?? '',
  }));
  return { error: null, items };
}

export type GeocodingRollbackState = { error: string | null; done: boolean };

/**
 * Roll a geocoding apply back to the coordinates its history record captured
 * — the same safety order as an apply: a NEW history record is written
 * first, then the coordinate revert. Refuses when the live row has moved on
 * past the entry being rolled back (stale rollback).
 */
export async function rollbackGeocodingAction(
  _prev: GeocodingRollbackState,
  formData: FormData,
): Promise<GeocodingRollbackState> {
  requireAdmin();
  const historyId = String(formData.get('history_id') ?? '');
  if (!historyId) return { error: 'Missing history id.', done: false };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('location_history')
    .select('id, location_id, changed_fields, source, created_at')
    .eq('id', historyId)
    .eq('source', 'geocoding')
    .maybeSingle();
  if (error || !data) return { error: error?.message ?? 'History record not found.', done: false };
  const entry = data as unknown as {
    id: string;
    location_id: string;
    created_at: string;
    changed_fields: { lat?: CoordChange; lng?: CoordChange };
  };
  const fromLat = entry.changed_fields?.lat?.from ?? null;
  const fromLng = entry.changed_fields?.lng?.from ?? null;
  const toLat = entry.changed_fields?.lat?.to ?? null;
  const toLng = entry.changed_fields?.lng?.to ?? null;

  // Lineage guard: only the NEWEST geocoding change for a listing may be
  // rolled back — value equality alone can be fooled by A→B→C→B sequences.
  const { data: newer, error: newerError } = await supabase
    .from('location_history')
    .select('id')
    .eq('location_id', entry.location_id)
    .eq('source', 'geocoding')
    .gt('created_at', entry.created_at)
    .limit(1);
  if (newerError) return { error: newerError.message, done: false };
  if (newer && newer.length > 0) {
    return {
      error: 'A newer geocoding change exists for this listing — roll back the newest entry first.',
      done: false,
    };
  }

  const { data: liveRow, error: liveError } = await supabase
    .from('locations')
    .select('id, lat, lng')
    .eq('id', entry.location_id)
    .is('deleted_at', null)
    .maybeSingle();
  if (liveError || !liveRow) {
    return { error: liveError?.message ?? 'Live listing not found.', done: false };
  }
  const live = liveRow as unknown as { lat: number | null; lng: number | null };
  // Only the change this entry made can be rolled back — if coordinates
  // changed again afterwards, rolling back would destroy the newer change.
  if (isStaleReview(toLat, toLng, live.lat, live.lng)) {
    return {
      error:
        'Live coordinates no longer match this entry — a newer change exists. Roll back the newest entry first.',
      done: false,
    };
  }

  const historyError = await recordHistory(supabase, {
    location_id: entry.location_id,
    source: 'geocoding',
    admin: MODERATION_ADMIN,
    changed_fields: {
      lat: { from: live.lat, to: fromLat },
      lng: { from: live.lng, to: fromLng },
    },
    note: `Rollback of geocoding history ${entry.id}`,
  });
  if (historyError) return { error: `History write failed: ${historyError}`, done: false };

  // Compare-and-swap on the coordinates observed above; the rollback also
  // clears the rolled-back apply's provenance (it described a coordinate
  // that no longer stands).
  let update = supabase
    .from('locations')
    .update({
      lat: fromLat,
      lng: fromLng,
      geocode_source: null,
      geocode_confidence: null,
      coord_verification_status: fromLat == null ? null : 'unverified',
      last_geocoded_at: new Date().toISOString(),
      manually_verified_at: null,
      manually_verified_by: null,
    })
    .eq('id', entry.location_id)
    .is('deleted_at', null);
  update = live.lat == null ? update.is('lat', null) : update.eq('lat', live.lat);
  update = live.lng == null ? update.is('lng', null) : update.eq('lng', live.lng);
  const { data: updatedRows, error: updateError } = await update.select('id');
  if (updateError) return { error: updateError.message, done: false };
  if (!updatedRows || updatedRows.length === 0) {
    return {
      error:
        'Not rolled back: the listing changed while this rollback was open. Refresh and retry.',
      done: false,
    };
  }

  revalidatePath('/admin/directory');
  revalidatePath('/directory');
  return { error: null, done: true };
}
