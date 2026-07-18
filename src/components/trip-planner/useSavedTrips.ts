'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  STORE_KEY,
  addPlannedTrip,
  addRecentPlace,
  clearAll as clearAllStore,
  clearRecents as clearRecentsStore,
  deleteFavorite as deleteFavoriteStore,
  deleteTruckPreset as deleteTruckPresetStore,
  deserialize,
  emptyStore,
  markFavoritePlanned,
  renameFavorite as renameFavoriteStore,
  saveFavorite as saveFavoriteStore,
  saveTruckPreset as saveTruckPresetStore,
  serialize,
  type PlaceRef,
  type PlannerStore,
  type PlannedTrip,
  type TruckPresetInput,
} from '@/lib/trip-planner/saved-trips-store';

/**
 * SSR-safe React hook over the pure local-device store. All persistence is
 * localStorage on the user's own device — no server writes, no account. Reads
 * are fail-soft (corrupt storage → empty state). `ready` gates rendering so the
 * server and first client paint agree (no hydration mismatch) before the
 * device's saved data appears.
 */

type Status = 'loading' | 'ready' | 'error';

function now(): number {
  return Date.now();
}

export function useSavedTrips() {
  const [store, setStore] = useState<PlannerStore>(() => emptyStore());
  const [status, setStatus] = useState<Status>('loading');
  const [storageAvailable, setStorageAvailable] = useState(false);
  // Ref mirrors for synchronous reads inside callbacks (no stale closures,
  // no re-creating callbacks on every change).
  const available = useRef(false);
  const storeRef = useRef(store);
  storeRef.current = store;

  // Load once on mount (client only).
  useEffect(() => {
    try {
      const ls = window.localStorage;
      available.current = true;
      setStorageAvailable(true);
      setStore(deserialize(ls.getItem(STORE_KEY), now()));
      setStatus('ready');
    } catch {
      // localStorage blocked (private mode / disabled) — degrade to in-memory.
      available.current = false;
      setStorageAvailable(false);
      setStatus('ready');
    }
  }, []);

  // Persist helper: `op` maps the CURRENT store → next. Crucially we advance
  // storeRef synchronously BEFORE setStore, so several mutations fired in one
  // synchronous block (e.g. record origin + destination + planned trip on a
  // successful plan) each compose on the previous result instead of all
  // reading the same pre-block snapshot and clobbering one another.
  const persist = useCallback((op: (prev: PlannerStore) => PlannerStore) => {
    const next = op(storeRef.current);
    storeRef.current = next;
    setStore(next);
    if (!available.current) return;
    try {
      window.localStorage.setItem(STORE_KEY, serialize(next));
    } catch {
      // Quota / disabled mid-session — keep the in-memory copy, stay silent.
    }
  }, []);

  const recordRecentPlace = useCallback(
    (place: PlaceRef) => persist((s) => addRecentPlace(s, place, now())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const recordPlannedTrip = useCallback(
    (trip: Omit<PlannedTrip, 'id' | 'plannedAt'>) => persist((s) => addPlannedTrip(s, trip, now())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const saveFavorite = useCallback(
    (input: { name?: string; origin: PlaceRef; destination: PlaceRef; truck: TruckPresetInput }) =>
      persist((s) => saveFavoriteStore(s, input, now())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const renameFavorite = useCallback(
    (id: string, name: string) => persist((s) => renameFavoriteStore(s, id, name, now())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const markPlanned = useCallback(
    (id: string) => persist((s) => markFavoritePlanned(s, id, now())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const deleteFavorite = useCallback(
    (id: string) => persist((s) => deleteFavoriteStore(s, id, now())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const saveTruckPreset = useCallback(
    (name: string, truck: TruckPresetInput) =>
      persist((s) => saveTruckPresetStore(s, name, truck, now())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const deleteTruckPreset = useCallback(
    (id: string) => persist((s) => deleteTruckPresetStore(s, id, now())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const clearRecents = useCallback(
    () => persist((s) => clearRecentsStore(s, now())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const clearAll = useCallback(
    () => persist(() => clearAllStore(now())),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  return {
    store,
    status,
    storageAvailable,
    recordRecentPlace,
    recordPlannedTrip,
    saveFavorite,
    renameFavorite,
    markPlanned,
    deleteFavorite,
    saveTruckPreset,
    deleteTruckPreset,
    clearRecents,
    clearAll,
  };
}
