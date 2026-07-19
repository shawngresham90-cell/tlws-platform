import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { guardedParse, errorJson } from '@/lib/trip-planner/api-util';
import { requireUser } from '@/lib/trip-planner/cloud-api';
import {
  PRESET_COLUMNS,
  deleteByClientIdsSchema,
  presetToRow,
  rowToPreset,
  truckPresetsUpsertSchema,
} from '@/lib/trip-planner/cloud-sync';

/** Cloud sync for truck presets — same session-bound, RLS-guarded rails. */
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const { data, error } = await auth.supabase
    .from('truck_presets')
    .select(PRESET_COLUMNS)
    .order('updated_at', { ascending: false })
    .limit(50);
  if (error) {
    console.error('[cloud/truck-presets] GET failed:', error.message);
    return errorJson(502, 'sync-read-failed', 'Could not load your truck presets.');
  }
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  return NextResponse.json({ ok: true, presets: rows.map((r) => rowToPreset(r)) });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const guarded = await guardedParse(req, truckPresetsUpsertSchema);
  if ('response' in guarded) return guarded.response;
  const rows = guarded.data.presets.map((p) => presetToRow(auth.userId, p));
  const { error } = await auth.supabase
    .from('truck_presets')
    .upsert(rows, { onConflict: 'user_id,client_id' });
  if (error) {
    console.error('[cloud/truck-presets] upsert failed:', error.message);
    return errorJson(502, 'sync-write-failed', 'Could not save your presets to the cloud.');
  }
  return NextResponse.json({ ok: true, count: rows.length });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const guarded = await guardedParse(req, deleteByClientIdsSchema);
  if ('response' in guarded) return guarded.response;
  const { error } = await auth.supabase
    .from('truck_presets')
    .delete()
    .eq('user_id', auth.userId)
    .in('client_id', guarded.data.clientIds);
  if (error) {
    console.error('[cloud/truck-presets] delete failed:', error.message);
    return errorJson(502, 'sync-delete-failed', 'Could not delete from the cloud.');
  }
  return NextResponse.json({ ok: true });
}
