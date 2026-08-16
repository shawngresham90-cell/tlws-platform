'use client';

import { createClient } from '@/lib/supabase/client';
import {
  SYNC_DOMAINS,
  decideAllDomains,
  uploadStillSafe,
  type SyncDecision,
  type SyncDomain,
  type SyncSnapshot,
} from '@/lib/navigator-account/state-sync';

/**
 * The read and write half of account sync. The policy lives in
 * lib/navigator-account/state-sync and is not re-implemented here — this file
 * moves rows, it does not decide anything.
 *
 * EVERY FUNCTION FAILS SOFT. A network error, a signed-out session, an
 * unapplied migration: all of them return "nothing happened" rather than
 * throwing. The local record is already written and complete on its own, so
 * the honest failure mode is a driver whose next device starts fresh — never
 * a driver who cannot start a route because a background write failed.
 *
 * OWNERSHIP IS NOT PASSED IN. `user_id` is filled from the session by RLS's
 * `with check (user_id = auth.uid())`, and the insert supplies it from the
 * verified user rather than from anything a caller could hand over. There is
 * no parameter here that could aim a write at someone else's row.
 */

type StateRow = {
  domain: string;
  payload: Record<string, unknown>;
  payload_version: number;
  updated_at: string;
};

function toSnapshot(row: StateRow): SyncSnapshot {
  return {
    payload: row.payload,
    payloadVersion: row.payload_version,
    updatedAtMs: new Date(row.updated_at).getTime(),
  };
}

/** Everything the account holds for this driver. Empty on any failure. */
export async function fetchCloudState(): Promise<Partial<Record<SyncDomain, SyncSnapshot>>> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return {};

    const { data, error } = await supabase
      .from('navigator_state')
      .select('domain, payload, payload_version, updated_at')
      .eq('user_id', user.id);
    if (error || !data) return {};

    const out: Partial<Record<SyncDomain, SyncSnapshot>> = {};
    for (const row of data as StateRow[]) {
      // Ignore a domain this build does not know. The database constrains the
      // set, but a newer app writing a fifth domain must not break an older one.
      if ((SYNC_DOMAINS as readonly string[]).includes(row.domain)) {
        out[row.domain as SyncDomain] = toSnapshot(row);
      }
    }
    return out;
  } catch {
    return {};
  }
}

/**
 * Write one domain, but only if it is still newer than what the server holds.
 *
 * The re-read before the write is the point. A debounce means seconds pass
 * between deciding to upload and uploading, and another device may have
 * written in that gap — so the comparison is made against the row as it is
 * NOW, not as it was when the driver stopped typing. Without this the "never
 * replace newer with older" rule holds only at decision time, which is
 * exactly when nothing is racing it.
 *
 * Returns true only when a row was actually written.
 */
export async function pushDomain(domain: SyncDomain, snapshot: SyncSnapshot): Promise<boolean> {
  try {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return false;

    const { data: current } = await supabase
      .from('navigator_state')
      .select('domain, payload, payload_version, updated_at')
      .eq('user_id', user.id)
      .eq('domain', domain)
      .maybeSingle();

    const serverNow = current ? toSnapshot(current as StateRow) : null;
    if (!uploadStillSafe({ candidate: snapshot, serverNow })) return false;

    const { error } = await supabase.from('navigator_state').upsert(
      {
        // From the verified session, never from a caller.
        user_id: user.id,
        domain,
        payload: snapshot.payload,
        payload_version: snapshot.payloadVersion,
        updated_at: new Date(snapshot.updatedAtMs).toISOString(),
      },
      { onConflict: 'user_id,domain' },
    );
    return !error;
  } catch {
    return false;
  }
}

/**
 * The first-sign-in reconciliation, one pass over all four domains.
 *
 * Returns what it decided per domain so the caller can apply the downloads to
 * local storage — this module never touches localStorage, because the
 * versioned-storage layer owns that and owns the parsing that makes it safe.
 */
export async function reconcile(input: {
  local: Partial<Record<SyncDomain, SyncSnapshot>>;
  supportedVersion: number;
}): Promise<{
  decisions: Record<SyncDomain, SyncDecision>;
  cloud: Partial<Record<SyncDomain, SyncSnapshot>>;
}> {
  const cloud = await fetchCloudState();
  const decisions = decideAllDomains({
    local: input.local,
    cloud,
    supportedVersion: input.supportedVersion,
  });

  // Uploads are safe to run here: they re-check against the server themselves.
  for (const domain of SYNC_DOMAINS) {
    if (decisions[domain] === 'upload') {
      const snapshot = input.local[domain];
      if (snapshot) await pushDomain(domain, snapshot);
    }
  }

  return { decisions, cloud };
}
