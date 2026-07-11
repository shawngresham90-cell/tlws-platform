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
    .select('id, name, address, city, state, lat, lng')
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

    // History BEFORE the coordinate write; failure aborts this row.
    const historyError = await recordHistory(supabase, {
      location_id: id,
      source: 'geocoding',
      admin: MODERATION_ADMIN,
      changed_fields: {
        lat: { from: row.live?.lat ?? null, to: row.proposed_latitude },
        lng: { from: row.live?.lng ?? null, to: row.proposed_longitude },
      },
      note:
        `Geocoding batch apply (confidence ${row.confidence}). Source: ` +
        `${row.source_url || 'n/a'}. ${row.verification_notes}`.slice(0, 500),
    });
    if (historyError) {
      failures.push({ id, name: row.business_name, error: `History write failed: ${historyError}` });
      continue;
    }

    const { error: updateError } = await supabase
      .from('locations')
      .update({ lat: row.proposed_latitude, lng: row.proposed_longitude })
      .eq('id', id)
      .is('deleted_at', null);
    if (updateError) {
      failures.push({ id, name: row.business_name, error: updateError.message });
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
