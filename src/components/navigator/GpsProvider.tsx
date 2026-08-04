'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createGpsSession, type GpsSession } from '@/lib/navigator/gps-session';
import type { GeolocationPort, GeoWatchOptions } from '@/lib/navigator/ports';
import type { PositionState } from '@/lib/navigator/types';

/**
 * The single `watchPosition` owner (milestone N2). Exactly one geolocation
 * subscription exists app-wide; every consumer reads gated state from this
 * context. The pure GPSSessionManager does all gating — this component
 * only adapts the browser API into the GeolocationPort and drives the
 * staleness tick while a watch is active.
 *
 * Privacy (AD-7): position lives in this component's state for the life of
 * the watch and nowhere else. Nothing is persisted, logged, or sent to
 * analytics; stopping the watch drops it. `start()` must only ever be
 * called from a direct user action — permission is requested where the
 * reason is on screen, never on page load.
 */

/** watchPosition options fixed by the architecture package (doc 05 §1). */
const WATCH_OPTIONS: GeoWatchOptions = {
  enableHighAccuracy: true,
  maximumAgeMs: 1000,
  timeoutMs: 15_000,
};

/** How often the staleness gate re-evaluates while a watch is active. */
const TICK_MS = 1000;

/** Adapt the browser geolocation API to the pure core's port. */
function createBrowserGeolocationPort(): GeolocationPort | null {
  if (typeof navigator === 'undefined' || !navigator.geolocation) return null;
  const geo = navigator.geolocation;
  return {
    watch(onFix, onError, options) {
      const id = geo.watchPosition(
        (pos) => {
          onFix({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracyM: pos.coords.accuracy,
            speedMps: pos.coords.speed,
            headingDeg: pos.coords.heading,
            tMs: pos.timestamp,
          });
        },
        (err) => {
          onError(
            err.code === err.PERMISSION_DENIED
              ? 'denied'
              : err.code === err.TIMEOUT
                ? 'timeout'
                : 'unavailable',
          );
        },
        {
          enableHighAccuracy: options.enableHighAccuracy,
          maximumAge: options.maximumAgeMs,
          timeout: options.timeoutMs,
        },
      );
      return () => geo.clearWatch(id);
    },
  };
}

type GpsContextValue = {
  position: PositionState;
  watching: boolean;
  /** True when the platform has no geolocation API at all. */
  supported: boolean;
  /** True from start() until the first fix or first error arrives. */
  acquiring: boolean;
  /** Start the single watch. Call ONLY from a direct user action. */
  start: () => void;
  stop: () => void;
};

const GpsContext = createContext<GpsContextValue | null>(null);

export function useGps(): GpsContextValue {
  const value = useContext(GpsContext);
  if (!value) throw new Error('useGps must be used inside <GpsProvider>');
  return value;
}

export function GpsProvider({
  children,
  /** Test seam: inject a synthetic port; defaults to the browser adapter. */
  port,
}: {
  children: ReactNode;
  port?: GeolocationPort;
}) {
  const sessionRef = useRef<GpsSession | null>(null);
  if (sessionRef.current === null) sessionRef.current = createGpsSession();
  const session = sessionRef.current;

  const [position, setPosition] = useState<PositionState>(session.state());
  const [watching, setWatching] = useState(false);
  const [supported, setSupported] = useState(true);
  // True from start() until the platform answers with a first fix OR a
  // first error. The pure session cannot distinguish "never asked" from a
  // real POSITION_UNAVAILABLE (both are health 'unavailable'), and only
  // the provider sees the callbacks — so acquisition is provider state.
  // Without it, a driver with OS location services disabled would read
  // "Waiting for permission…" forever instead of the truth.
  const [acquiring, setAcquiring] = useState(false);
  const cancelRef = useRef<(() => void) | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The single-watch guard. cancelRef cannot serve this purpose during the
  // port's synchronous watch() call (its cancel function does not exist
  // yet), so a dedicated flag guards callbacks and detects a synchronous
  // denial delivered before watch() returns.
  const activeRef = useRef(false);

  /** Cancel the watch and the tick without touching session state. */
  const teardown = useCallback(() => {
    activeRef.current = false;
    if (cancelRef.current) {
      cancelRef.current();
      cancelRef.current = null;
    }
    if (tickRef.current !== null) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    teardown();
    // Position is ephemeral: stopping the watch drops it entirely.
    setPosition(session.reset());
    setWatching(false);
    setAcquiring(false);
  }, [session, teardown]);

  const start = useCallback(() => {
    if (activeRef.current) return; // already the single active watch
    const activePort = port ?? createBrowserGeolocationPort();
    if (!activePort) {
      setSupported(false);
      return;
    }
    activeRef.current = true;
    const cancel = activePort.watch(
      (fix) => {
        // Port contract says no callbacks after cancel; guard anyway so a
        // contract-violating injected port cannot repopulate dropped state.
        if (!activeRef.current) return;
        setAcquiring(false);
        setPosition(session.ingestFix(fix));
      },
      (kind) => {
        if (!activeRef.current) return;
        setAcquiring(false);
        if (kind === 'denied') {
          // Denial is terminal for this watch: the browser will not deliver
          // again. Tear the dead watch down so "Enable location" genuinely
          // comes back, but KEEP the denied state visible — resetting it
          // would hide why the preview stopped.
          setPosition(session.ingestError('denied'));
          teardown();
          setWatching(false);
          return;
        }
        setPosition(session.ingestError(kind));
      },
      WATCH_OPTIONS,
    );
    if (!activeRef.current) {
      // A synchronous error (injected ports) tore us down mid-watch();
      // the cancel function only exists now, so finish the cancellation.
      cancel();
      return;
    }
    cancelRef.current = cancel;
    tickRef.current = setInterval(() => setPosition(session.tick(Date.now())), TICK_MS);
    setWatching(true);
    setAcquiring(session.state().fix === null);
  }, [port, session, teardown]);

  // Unmount = navigation away: the watch must never outlive its owner.
  useEffect(() => stop, [stop]);

  const value = useMemo(
    () => ({ position, watching, supported, acquiring, start, stop }),
    [position, watching, supported, acquiring, start, stop],
  );
  return <GpsContext.Provider value={value}>{children}</GpsContext.Provider>;
}
