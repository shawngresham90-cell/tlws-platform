import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { guardedParse, errorJson } from '@/lib/trip-planner/api-util';
import { requireUser } from '@/lib/trip-planner/cloud-api';
import {
  TRIP_COLUMNS,
  deleteByClientIdsSchema,
  rowToTrip,
  savedTripsUpsertSchema,
  tripToRow,
} from '@/lib/trip-planner/cloud-sync';

/**
 * Cloud sync for saved trips. Session-bound (RLS + explicit session user_id);
 * a client can never read or write another user's rows. Rate-limited and
 * Zod-validated like the rest of the planner API. Never blocks planning — the
 * client treats any failure as "sync failed" and keeps working locally.
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const { data, error } = await auth.supabase
    .from('saved_trips')
    .select(TRIP_COLUMNS)
    .order('updated_at', { ascending: false })
    .limit(100);
  if (error) {
    // Log server-side detail only; never leak it to the client.
    console.error('[cloud/saved-trips] GET failed:', error.message);
    return errorJson(502, 'sync-read-failed', 'Could not load your saved trips.');
  }
  const rows = (data ?? []) as unknown as Record<string, unknown>[];
  return NextResponse.json({ ok: true, trips: rows.map((r) => rowToTrip(r)) });
}

export async function POST(req: NextRequest) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const guarded = await guardedParse(req, savedTripsUpsertSchema);
  if ('response' in guarded) return guarded.response;

  // Ownership is injected from the session for every row; the client's payload
  // has no user_id field, so cross-user writes are impossible. Idempotent on
  // (user_id, client_id).
  const rows = guarded.data.trips.map((t) => tripToRow(auth.userId, t));
  const { error } = await auth.supabase
    .from('saved_trips')
    .upsert(rows, { onConflict: 'user_id,client_id' });
  if (error) {
    console.error('[cloud/saved-trips] upsert failed:', error.message);
    return errorJson(502, 'sync-write-failed', 'Could not save your trips to the cloud.');
  }
  return NextResponse.json({ ok: true, count: rows.length });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireUser();
  if ('response' in auth) return auth.response;
  const guarded = await guardedParse(req, deleteByClientIdsSchema);
  if ('response' in guarded) return guarded.response;
  const { error } = await auth.supabase
    .from('saved_trips')
    .delete()
    .eq('user_id', auth.userId)
    .in('client_id', guarded.data.clientIds);
  if (error) {
    console.error('[cloud/saved-trips] delete failed:', error.message);
    return errorJson(502, 'sync-delete-failed', 'Could not delete from the cloud.');
  }
  return NextResponse.json({ ok: true });
}
