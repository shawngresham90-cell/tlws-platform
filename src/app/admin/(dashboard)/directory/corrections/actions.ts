'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/admin/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { MODERATION_ADMIN } from '@/lib/admin/community';
import { recordHistory } from '@/lib/admin/history';
import {
  parseCorrectionsCsv,
  validateCorrections,
  correctionPatch,
  correctionChangedFields,
  type CorrectionLiveRow,
  type ValidatedCorrectionRow,
} from '@/lib/directory/corrections';

/**
 * Bulk-correction writes (Milestone 21). Preview is a pure dry run; apply
 * re-parses and re-validates the SAME CSV server-side, applies only selected
 * rows that independently validate, requires an extra confirmation for rows
 * that blank existing data, writes history BEFORE each row's update (source
 * 'admin-edit', note prefix 'correction-csv:'), and each row is atomic —
 * a history failure aborts that row, other rows proceed, and every outcome
 * is reported. Only diffed allowlisted columns are ever written.
 */

const MAX_CSV_BYTES = 2 * 1024 * 1024;

const LIVE_COLUMNS =
  'id, name, category_slug, type, address, city, state, zip, phone, website, description, ' +
  'free_parking, paid_parking, reserved_parking, overnight_parking, parking_spaces, amenities, ' +
  'tpc_url, interstate, exit_number, verified_at';

async function getLiveRows(): Promise<Map<string, CorrectionLiveRow>> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('locations')
    .select(LIVE_COLUMNS)
    .is('deleted_at', null)
    .limit(5000);
  if (error || !data) throw new Error(error?.message ?? 'Could not load live listings');
  return new Map(
    (data as unknown as Record<string, unknown>[]).map((r) => [
      String(r.id),
      {
        id: String(r.id),
        name: String(r.name),
        city: String(r.city),
        state: String(r.state),
        values: {
          name: r.name,
          address: r.address,
          city: r.city,
          state: r.state,
          zip: r.zip,
          phone: r.phone,
          website: r.website,
          category_slug: r.category_slug,
          interstate: r.interstate,
          exit_number: r.exit_number,
          description: r.description,
          free_parking: r.free_parking,
          paid_parking: r.paid_parking,
          reserved_parking: r.reserved_parking,
          overnight_parking: r.overnight_parking,
          parking_spaces: r.parking_spaces,
          amenities: r.amenities ?? [],
          tpc_url: r.tpc_url,
          verified_at: r.verified_at,
        },
      },
    ]),
  );
}

function readCsvText(formData: FormData): { text?: string; error?: string } {
  const text = formData.get('csv_text');
  if (typeof text !== 'string' || text.trim() === '') {
    return { error: 'Choose a corrections CSV first.' };
  }
  if (text.length > MAX_CSV_BYTES) return { error: 'File too large (max 2 MB).' };
  return { text };
}

export type CorrectionsPreviewState = {
  error: string | null;
  fileErrors: string[];
  rows: ValidatedCorrectionRow[] | null;
};

export async function previewCorrectionsAction(
  _prev: CorrectionsPreviewState,
  formData: FormData,
): Promise<CorrectionsPreviewState> {
  requireAdmin();
  const { text, error } = readCsvText(formData);
  if (error || !text) return { error: error ?? 'No file.', fileErrors: [], rows: null };

  const parsed = parseCorrectionsCsv(text);
  if (!parsed.ok) return { error: 'The file cannot be processed.', fileErrors: parsed.errors, rows: null };
  try {
    const live = await getLiveRows();
    return {
      error: null,
      fileErrors: [],
      rows: validateCorrections(parsed.rows, parsed.editableColumns, live),
    };
  } catch (e) {
    return { error: (e as Error).message, fileErrors: [], rows: null };
  }
}

export type CorrectionsApplyState = {
  error: string | null;
  applied: number;
  skipped: number;
  failures: { id: string; name: string; error: string }[];
  done: boolean;
};

export async function applyCorrectionsAction(
  _prev: CorrectionsApplyState,
  formData: FormData,
): Promise<CorrectionsApplyState> {
  requireAdmin();
  const fail = (error: string): CorrectionsApplyState => ({
    error,
    applied: 0,
    skipped: 0,
    failures: [],
    done: false,
  });

  const { text, error } = readCsvText(formData);
  if (error || !text) return fail(error ?? 'No file.');

  let selected: string[];
  let blankingConfirmed: string[];
  try {
    selected = JSON.parse(String(formData.get('selected') ?? '[]'));
    blankingConfirmed = JSON.parse(String(formData.get('blanking_confirmed') ?? '[]'));
    if (!Array.isArray(selected) || !Array.isArray(blankingConfirmed)) throw new Error();
  } catch {
    return fail('Invalid selection payload.');
  }
  if (selected.length === 0) return fail('Select at least one row to apply.');

  const parsed = parseCorrectionsCsv(text);
  if (!parsed.ok) return fail(parsed.errors.join('; '));
  let rows: ValidatedCorrectionRow[];
  try {
    rows = validateCorrections(parsed.rows, parsed.editableColumns, await getLiveRows());
  } catch (e) {
    return fail((e as Error).message);
  }
  const byId = new Map(rows.map((r) => [r.listingId, r]));
  const confirmedBlanking = new Set(blankingConfirmed.map(String));

  const supabase = createAdminClient();
  let applied = 0;
  let skipped = 0;
  const failures: CorrectionsApplyState['failures'] = [];

  for (const id of selected.map(String)) {
    const row = byId.get(id);
    if (!row) {
      failures.push({ id, name: id, error: 'Selected row not found in the uploaded file.' });
      continue;
    }
    if (!row.applicable) {
      skipped += 1;
      continue;
    }
    if (row.hasBlanking && !confirmedBlanking.has(id)) {
      failures.push({
        id,
        name: row.liveName ?? row.matchName,
        error: 'Row blanks existing data — needs explicit confirmation.',
      });
      continue;
    }

    // History BEFORE the write; failure aborts this row.
    const historyError = await recordHistory(supabase, {
      location_id: id,
      source: 'admin-edit',
      admin: MODERATION_ADMIN,
      changed_fields: correctionChangedFields(row),
      note: `correction-csv: ${row.changes.map((c) => c.column).join(', ')}`.slice(0, 500),
    });
    if (historyError) {
      failures.push({
        id,
        name: row.liveName ?? row.matchName,
        error: `History write failed: ${historyError}`,
      });
      continue;
    }

    const { error: updateError } = await supabase
      .from('locations')
      .update(correctionPatch(row))
      .eq('id', id)
      .is('deleted_at', null);
    if (updateError) {
      failures.push({ id, name: row.liveName ?? row.matchName, error: updateError.message });
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
