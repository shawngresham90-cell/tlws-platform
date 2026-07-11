import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ChangedFields } from './community';

/**
 * Location change history (Milestone 16, P4). Approval flows call
 * recordHistory BEFORE mutating a listing, so the "what changed / who / when"
 * record exists even if the mutation itself fails halfway. A failed history
 * write ABORTS the change — a listing is never overwritten without a record.
 */

export type HistorySource = 'submission' | 'review' | 'admin-edit' | 'merge' | 'closure';

export type HistoryEntry = {
  location_id: string;
  source: HistorySource;
  /** The submission/review row this change came from, if any. */
  source_id?: string;
  admin: string;
  changed_fields: ChangedFields;
  note?: string;
};

export async function recordHistory(
  supabase: SupabaseClient,
  entry: HistoryEntry,
): Promise<string | null> {
  const { error } = await supabase.from('location_history').insert({
    location_id: entry.location_id,
    source: entry.source,
    source_id: entry.source_id ?? null,
    admin: entry.admin,
    changed_fields: entry.changed_fields,
    note: entry.note ?? null,
  });
  return error ? error.message : null;
}

export type HistoryRow = {
  id: string;
  location_id: string;
  source: HistorySource;
  source_id: string | null;
  admin: string;
  changed_fields: ChangedFields;
  note: string | null;
  created_at: string;
};

/** Newest-first change history for one listing (admin detail surfaces). */
export async function getHistoryForLocation(
  locationId: string,
  limit = 20,
): Promise<HistoryRow[]> {
  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('location_history')
      .select('id, location_id, source, source_id, admin, changed_fields, note, created_at')
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return data as unknown as HistoryRow[];
  } catch {
    return [];
  }
}
