'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { MODERATION_ADMIN } from '@/lib/admin/community';
import { recordHistory } from '@/lib/admin/history';
import {
  parseTpcCsv,
  validateTpcBatch,
  type TpcListingRef,
  type ValidatedTpcRow,
} from '@/lib/directory/tpc';

/**
 * Truck Parking Club bulk-management writes (Milestone 21). Same discipline
 * as the geocoding tool: preview never writes; apply re-parses and
 * re-validates the SAME uploaded CSV server-side, applies only selected rows
 * that independently validate, requires explicit per-row confirmation before
 * replacing an existing URL, and writes a location_history record BEFORE
 * each update (source 'admin-edit', note prefix 'tpc-bulk:') — a failed
 * history write aborts that row. Only the tpc_url column is ever touched.
 */

const MAX_CSV_BYTES = 2 * 1024 * 1024;

async function getLiveRefs(): Promise<Map<string, TpcListingRef>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('locations')
    .select('id, name, category_slug, address, city, state, tpc_url, is_published, detail_slug')
    .is('deleted_at', null)
    .limit(5000);
  if (error || !data) throw new Error(error?.message ?? 'Could not load live listings');
  return new Map(
    (
      data as unknown as {
        id: string;
        name: string;
        category_slug: string | null;
        address: string | null;
        city: string;
        state: string;
        tpc_url: string | null;
        is_published: boolean;
        detail_slug: string | null;
      }[]
    ).map((r) => [
      r.id,
      {
        id: r.id,
        name: r.name,
        category: r.category_slug,
        address: r.address,
        city: r.city,
        state: r.state,
        tpcUrl: r.tpc_url,
        published: r.is_published,
        detailSlug: r.detail_slug,
      },
    ]),
  );
}

function readCsvText(formData: FormData): { text?: string; error?: string } {
  const text = formData.get('csv_text');
  if (typeof text !== 'string' || text.trim() === '') {
    return { error: 'Choose a TPC correction CSV first.' };
  }
  if (text.length > MAX_CSV_BYTES) return { error: 'File too large (max 2 MB).' };
  return { text };
}

export type TpcPreviewState = {
  error: string | null;
  fileErrors: string[];
  rows: ValidatedTpcRow[] | null;
};

export async function previewTpcAction(
  _prev: TpcPreviewState,
  formData: FormData,
): Promise<TpcPreviewState> {
  requireAdmin();
  const { text, error } = readCsvText(formData);
  if (error || !text) return { error: error ?? 'No file.', fileErrors: [], rows: null };

  const parsed = parseTpcCsv(text);
  if (parsed.rows.length === 0) {
    return { error: 'No valid rows found in the file.', fileErrors: parsed.errors, rows: null };
  }
  try {
    const live = await getLiveRefs();
    return { error: null, fileErrors: parsed.errors, rows: validateTpcBatch(parsed.rows, live) };
  } catch (e) {
    return { error: (e as Error).message, fileErrors: parsed.errors, rows: null };
  }
}

export type TpcApplyState = {
  error: string | null;
  applied: number;
  skipped: number;
  failures: { id: string; name: string; error: string }[];
  done: boolean;
};

export async function applyTpcAction(
  _prev: TpcApplyState,
  formData: FormData,
): Promise<TpcApplyState> {
  requireAdmin();
  const fail = (error: string): TpcApplyState => ({
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

  const parsed = parseTpcCsv(text);
  let rows: ValidatedTpcRow[];
  try {
    rows = validateTpcBatch(parsed.rows, await getLiveRefs());
  } catch (e) {
    return fail((e as Error).message);
  }
  const byId = new Map(rows.map((r) => [r.listing_id, r]));
  const confirmedOverwrites = new Set(overwriteConfirmed.map(String));

  const supabase = createAdminClient();
  let applied = 0;
  let skipped = 0;
  const failures: TpcApplyState['failures'] = [];

  for (const id of selected.map(String)) {
    const row = byId.get(id);
    if (!row) {
      failures.push({ id, name: id, error: 'Selected row not found in the uploaded file.' });
      continue;
    }
    // Server-side gate: the client's idea of applicability is never trusted.
    if (!row.applicable) {
      skipped += 1;
      continue;
    }
    if (row.wouldOverwrite && !confirmedOverwrites.has(id)) {
      failures.push({
        id,
        name: row.business_name,
        error: 'Existing TPC URL would be replaced — needs explicit confirmation.',
      });
      continue;
    }

    // History BEFORE the write; failure aborts this row.
    const historyError = await recordHistory(supabase, {
      location_id: id,
      source: 'admin-edit',
      admin: MODERATION_ADMIN,
      changed_fields: { tpc_url: { from: row.live?.tpcUrl ?? null, to: row.nextValue } },
      note: `tpc-bulk: ${row.action} via correction CSV`.slice(0, 500),
    });
    if (historyError) {
      failures.push({ id, name: row.business_name, error: `History write failed: ${historyError}` });
      continue;
    }

    const { error: updateError } = await supabase
      .from('locations')
      .update({ tpc_url: row.nextValue })
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
    revalidatePath('/directory/location/[slug]', 'page');
  }
  return { error: null, applied, skipped, failures, done: true };
}
