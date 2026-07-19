'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  cloudToFavorite,
  cloudToPresetLocal,
  dedupeQueue,
  favoriteToCloud,
  mergeFavorites,
  mergePresets,
  presetToCloud,
  type CloudSavedTrip,
  type CloudTruckPreset,
  type SyncOp,
} from '@/lib/trip-planner/cloud-sync';
import type { FavoriteRoute, TruckPreset } from '@/lib/trip-planner/saved-trips-store';

/**
 * Cloud-sync + public-auth hook (End-User Accounts milestone). Offline-first:
 * signed-out users make ZERO cloud requests and keep the local store exactly as
 * before. Signed-in users get their saved trips + truck presets synced across
 * devices; recent searches are NEVER uploaded. Cloud sync never blocks route
 * planning — every failure degrades to a visible status and the local store.
 *
 * Public auth (email OTP) is a plain Supabase session — entirely separate from
 * the admin password / HMAC cookie / admin routes.
 */

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';
export type AuthStatus = 'loading' | 'signed-out' | 'signed-in';

type LocalSnapshot = { favorites: FavoriteRoute[]; presets: TruckPreset[] };

export type CloudSyncDeps = {
  /** Read the current local favorites + presets. */
  getLocal: () => LocalSnapshot;
  /** Replace local favorites + presets after a merge (writes through storage). */
  applyMerged: (favorites: FavoriteRoute[], presets: TruckPreset[]) => void;
  /** Called on sign-out to clear cloud-backed local data (cross-user isolation). */
  onSignedOut: () => void;
};

const queueKey = (userId: string) => `tlws:tp:syncq:${userId}`;

function loadQueue(userId: string): SyncOp[] {
  try {
    const raw = window.localStorage.getItem(queueKey(userId));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as SyncOp[]) : [];
  } catch {
    return [];
  }
}
function saveQueue(userId: string, q: SyncOp[]) {
  try {
    window.localStorage.setItem(queueKey(userId), JSON.stringify(q));
  } catch {
    /* fail-soft */
  }
}

export function useCloudSync(deps: CloudSyncDeps) {
  const depsRef = useRef(deps);
  depsRef.current = deps;

  const supabaseRef = useRef<ReturnType<typeof createClient> | null>(null);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading');
  const [email, setEmail] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  // Gates the app's change-diff effect: true only AFTER the first successful
  // merge, so the merge's own writes (incl. cap eviction) are never mistaken
  // for user deletes/edits.
  const [syncReady, setSyncReady] = useState(false);
  const userIdRef = useRef<string | null>(null);

  const getSupabase = () => {
    if (!supabaseRef.current) supabaseRef.current = createClient();
    return supabaseRef.current;
  };

  /* -------------------------------------------------- push the offline queue */
  const flush = useCallback(async () => {
    const userId = userIdRef.current;
    if (!userId) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSyncStatus('offline');
      return;
    }
    let queue = dedupeQueue(loadQueue(userId));
    if (queue.length === 0) {
      setSyncStatus('synced');
      return;
    }
    setSyncStatus('syncing');
    const { favorites, presets } = depsRef.current.getLocal();
    const favById = new Map(favorites.map((f) => [f.id, f]));
    const presetById = new Map(presets.map((p) => [p.id, p]));

    const tripUpserts: CloudSavedTrip[] = [];
    const tripDeletes: string[] = [];
    const presetUpserts: CloudTruckPreset[] = [];
    const presetDeletes: string[] = [];
    for (const op of queue) {
      if (op.kind === 'upsert-trip' && favById.has(op.clientId))
        tripUpserts.push(favoriteToCloud(favById.get(op.clientId)!));
      else if (op.kind === 'delete-trip') tripDeletes.push(op.clientId);
      else if (op.kind === 'upsert-preset' && presetById.has(op.clientId))
        presetUpserts.push(presetToCloud(presetById.get(op.clientId)!));
      else if (op.kind === 'delete-preset') presetDeletes.push(op.clientId);
    }

    const post = (path: string, body: unknown) =>
      fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
    const del = (path: string, body: unknown) =>
      fetch(path, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

    try {
      const calls: Promise<Response>[] = [];
      if (tripUpserts.length)
        calls.push(post('/api/trip-planner/cloud/saved-trips', { trips: tripUpserts }));
      if (tripDeletes.length)
        calls.push(del('/api/trip-planner/cloud/saved-trips', { clientIds: tripDeletes }));
      if (presetUpserts.length)
        calls.push(post('/api/trip-planner/cloud/truck-presets', { presets: presetUpserts }));
      if (presetDeletes.length)
        calls.push(del('/api/trip-planner/cloud/truck-presets', { clientIds: presetDeletes }));
      const results = await Promise.all(calls);
      if (results.every((r) => r.ok)) {
        queue = [];
        saveQueue(userId, queue);
        setSyncStatus('synced');
      } else {
        setSyncStatus('error');
      }
    } catch {
      // Network failure — keep the queue for the next reconnect.
      setSyncStatus(navigator?.onLine === false ? 'offline' : 'error');
    }
  }, []);

  const enqueue = useCallback(
    (op: SyncOp) => {
      const userId = userIdRef.current;
      if (!userId) return; // signed-out: never queues, never calls cloud
      const q = dedupeQueue([...loadQueue(userId), op]);
      saveQueue(userId, q);
      void flush();
    },
    [flush],
  );

  /* ---------------------------------------------------- first-sign-in merge */
  const initialSync = useCallback(async () => {
    const userId = userIdRef.current;
    if (!userId) return;
    setSyncReady(false);
    setSyncStatus('syncing');

    // Drain any queued ops to the server FIRST, so a pending delete reaches the
    // cloud before we read it back (otherwise a stale GET resurrects it).
    await flush();
    // Whatever is still queued (e.g. we're offline) acts as a TOMBSTONE set:
    // filter those ids out of the cloud snapshot so a not-yet-synced delete is
    // never merged back in.
    const remaining = dedupeQueue(loadQueue(userId));
    const delTrips = new Set(
      remaining.filter((o) => o.kind === 'delete-trip').map((o) => o.clientId),
    );
    const delPresets = new Set(
      remaining.filter((o) => o.kind === 'delete-preset').map((o) => o.clientId),
    );

    try {
      const [tRes, pRes] = await Promise.all([
        fetch('/api/trip-planner/cloud/saved-trips'),
        fetch('/api/trip-planner/cloud/truck-presets'),
      ]);
      if (!tRes.ok || !pRes.ok) {
        setSyncStatus('error');
        return;
      }
      const tJson = (await tRes.json()) as { trips?: CloudSavedTrip[] };
      const pJson = (await pRes.json()) as { presets?: CloudTruckPreset[] };
      const cloudFavs = (tJson.trips ?? [])
        .filter((t) => !delTrips.has(t.clientId))
        .map(cloudToFavorite);
      const cloudPresets = (pJson.presets ?? [])
        .filter((p) => !delPresets.has(p.clientId))
        .map(cloudToPresetLocal);

      const { favorites, presets } = depsRef.current.getLocal();
      const favMerge = mergeFavorites(favorites, cloudFavs);
      const presetMerge = mergePresets(presets, cloudPresets);

      // Never delete local data on first sign-in — write the union back.
      depsRef.current.applyMerged(favMerge.merged, presetMerge.merged);

      // Push anything the cloud doesn't have (or that the local edit won).
      const ops: SyncOp[] = [
        ...favMerge.toPush.map((f) => ({ kind: 'upsert-trip', clientId: f.id }) as SyncOp),
        ...presetMerge.toPush.map((p) => ({ kind: 'upsert-preset', clientId: p.id }) as SyncOp),
      ];
      if (ops.length) {
        saveQueue(userId, dedupeQueue([...loadQueue(userId), ...ops]));
      }
      await flush();
      // Merge complete — the app may now diff subsequent user changes.
      setSyncReady(true);
    } catch {
      setSyncStatus(navigator?.onLine === false ? 'offline' : 'error');
    }
  }, [flush]);

  /* --------------------------------------------------------- auth lifecycle */
  useEffect(() => {
    const supabase = getSupabase();
    let active = true;
    supabase.auth
      .getUser()
      .then(({ data }) => {
        if (!active) return;
        if (data.user) {
          userIdRef.current = data.user.id;
          setEmail(data.user.email ?? null);
          setAuthStatus('signed-in');
          void initialSync();
        } else {
          setAuthStatus('signed-out');
        }
      })
      .catch(() => {
        // Supabase unreachable — never block the planner. Present as signed-out
        // (local-only) so route planning and the local store keep working.
        if (active) setAuthStatus('signed-out');
      });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        userIdRef.current = session.user.id;
        setEmail(session.user.email ?? null);
        setAuthStatus('signed-in');
        void initialSync();
      } else if (event === 'SIGNED_OUT') {
        userIdRef.current = null;
        setEmail(null);
        setAuthStatus('signed-out');
        setSyncStatus('idle');
        setSyncReady(false);
        depsRef.current.onSignedOut(); // cross-user isolation: clear local
      }
    });
    const onOnline = () => void flush();
    window.addEventListener('online', onOnline);
    return () => {
      active = false;
      sub.subscription.unsubscribe();
      window.removeEventListener('online', onOnline);
    };
  }, [initialSync, flush]);

  /* ------------------------------------------------------------- auth verbs */
  const sendOtp = useCallback(async (addr: string) => {
    try {
      const { error } = await getSupabase().auth.signInWithOtp({
        email: addr.trim(),
        options: { shouldCreateUser: true },
      });
      return error ? { ok: false as const, message: error.message } : { ok: true as const };
    } catch {
      return { ok: false as const, message: 'Could not send the code. Check your connection.' };
    }
  }, []);

  const verifyOtp = useCallback(async (addr: string, token: string) => {
    try {
      const { error } = await getSupabase().auth.verifyOtp({
        email: addr.trim(),
        token: token.trim(),
        type: 'email',
      });
      return error ? { ok: false as const, message: error.message } : { ok: true as const };
    } catch {
      return { ok: false as const, message: 'Could not verify the code.' };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await getSupabase().auth.signOut();
    } catch {
      /* fall through — the SIGNED_OUT handler still clears local state */
    }
  }, []);

  /** Delete ALL of this user's cloud trips + presets (local copy is kept). */
  const deleteAllCloud = useCallback(async () => {
    if (!userIdRef.current) return { ok: false as const };
    try {
      const [tRes, pRes] = await Promise.all([
        fetch('/api/trip-planner/cloud/saved-trips'),
        fetch('/api/trip-planner/cloud/truck-presets'),
      ]);
      if (!tRes.ok || !pRes.ok) return { ok: false as const };
      const trips = ((await tRes.json()).trips ?? []) as { clientId: string }[];
      const presets = ((await pRes.json()).presets ?? []) as { clientId: string }[];
      const calls: Promise<Response>[] = [];
      if (trips.length)
        calls.push(
          fetch('/api/trip-planner/cloud/saved-trips', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientIds: trips.map((t) => t.clientId) }),
          }),
        );
      if (presets.length)
        calls.push(
          fetch('/api/trip-planner/cloud/truck-presets', {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ clientIds: presets.map((p) => p.clientId) }),
          }),
        );
      const results = await Promise.all(calls);
      return { ok: results.every((r) => r.ok) };
    } catch {
      return { ok: false as const };
    }
  }, []);

  return {
    authStatus,
    email,
    syncStatus,
    syncReady,
    sendOtp,
    verifyOtp,
    signOut,
    deleteAllCloud,
    syncNow: initialSync,
    enqueueUpsertTrip: (clientId: string) => enqueue({ kind: 'upsert-trip', clientId }),
    enqueueDeleteTrip: (clientId: string) => enqueue({ kind: 'delete-trip', clientId }),
    enqueueUpsertPreset: (clientId: string) => enqueue({ kind: 'upsert-preset', clientId }),
    enqueueDeletePreset: (clientId: string) => enqueue({ kind: 'delete-preset', clientId }),
  };
}
