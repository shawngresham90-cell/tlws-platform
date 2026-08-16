'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  SYNC_DEBOUNCE_MS,
  SYNC_DOMAINS,
  retryDelayFor,
  syncFailureBlocksDriving,
  type SyncDomain,
  type SyncStatus,
} from '@/lib/navigator-account/state-sync';
import { pushDomain, reconcile } from './sync-client';
import {
  SUPPORTED_PAYLOAD_VERSION,
  applyDownloadedSnapshot,
  markDomainSaved,
  readLocalSnapshot,
  readLocalSnapshots,
} from './sync-domain-storage';

/**
 * Account sync, as the driving screen sees it.
 *
 * This is the ONLY thing that connects the four device records to the four
 * account rows. The policy is in `lib/navigator-account/state-sync`, the
 * network is in `sync-client`, the storage is in `sync-domain-storage`; this
 * file is the schedule and the lifecycle, and it decides nothing else.
 *
 * ---------------------------------------------------------------------------
 * THE ONE RULE THAT OUTRANKS THE OTHERS
 *
 * A cloud failure never stands between a driver and a route. The local write
 * has already completed before anything here is called — `notifySaved` is
 * told what happened, it does not perform the save — so every path through
 * this module can fail, silently, without the driver losing anything they can
 * see or being stopped from starting. `syncFailureBlocksDriving()` is
 * referenced below so that a future edit has to argue with a name rather than
 * a comment.
 *
 * There is deliberately NO SYNC UI ON THE DRIVING SURFACE. The status this
 * hook returns is for the Account screen. A driver who is moving cannot act on
 * "we could not reach your account", the local copy is intact, and the message
 * would be a distraction with no action attached.
 *
 * ---------------------------------------------------------------------------
 * WHY EVERY PUSH RE-READS STORAGE INSTEAD OF CARRYING A VALUE
 *
 * `notifySaved(domain)` takes no payload. It is a nudge, not a delivery.
 *
 * That is what makes stale closures structurally impossible here rather than
 * merely avoided. A debounce means seconds pass between the driver's edit and
 * the write; if the payload rode along from the moment of the edit, a second
 * edit inside the window would either upload the first value or need a queue
 * that re-orders correctly under retry. Instead the flush reads the CURRENT
 * record at the moment it writes, so whatever it sends is by construction the
 * latest thing on the device — no matter how many edits the debounce
 * collapsed, no matter how long a retry waited.
 *
 * The same property is why the effect below has an empty dependency list and
 * still cannot go stale: everything mutable lives in a ref that the effect
 * reads at call time, so nothing is captured.
 *
 * ---------------------------------------------------------------------------
 * WHY RESTORE HAPPENS ONCE, AND WHAT IT NUDGES
 *
 * `reconcile()` runs on the first mount where sync is enabled and never again.
 * Downloads are applied to device storage, and then `restoreNonce` increments.
 *
 * The screen's own restore effects re-run on that nonce and re-read their
 * records — which is why nothing here reaches into the screen's state, and why
 * a download cannot half-apply. The nonce changes at most once per mount, so a
 * driver who is mid-edit when a download lands cannot have the form pulled
 * from under them twice, and a render loop is not possible: the value is
 * monotonic and set exactly once.
 */

/**
 * The network edge, as a port.
 *
 * The rest of this module — the debounce, the retry ladder, the read-at-flush
 * discipline, the once-per-mount restore — is the part that can be wrong in
 * ways nobody notices, and none of it can be exercised through a real Supabase
 * client offline: `getUser()` returns null without so much as a request when
 * there is no stored session, so a fake HTTP layer proves nothing at all.
 *
 * So the two calls that cross the network are injectable, exactly as the
 * routing adapter's fetcher and the voice adapter's speech sink already are.
 * A test supplies a transport and renders the REAL driving screen: real
 * component, real hook, real storage modules, real conflict policy, with only
 * the wire replaced. That is the difference between proving the screen syncs
 * and proving a standalone client works.
 *
 * The default is the real client, so no production caller passes anything.
 */
export type SyncTransport = Readonly<{
  reconcile: typeof reconcile;
  push: typeof pushDomain;
}>;

export const REAL_SYNC_TRANSPORT: SyncTransport = { reconcile, push: pushDomain };

export type AccountSync = Readonly<{
  /**
   * Increments when a download has been written to device storage. Restore
   * effects list it as a dependency; nothing else should read it.
   */
  restoreNonce: number;
  /**
   * Tell sync that a domain's local record was just written. Cheap,
   * synchronous, and safe to call when signed out or in another access mode.
   */
  notifySaved: (domain: SyncDomain) => void;
  /** For the Account screen only. Never rendered on the driving surface. */
  status: SyncStatus;
  /** Manual retry, offered on the Account screen. */
  retryNow: () => void;
}>;

export function useAccountSync(input: {
  /**
   * True only in account mode. The server decides this and passes it down —
   * the client never infers it, because the access mode is server-only and a
   * client guess would be a second, disagreeing copy of the gate.
   */
  enabled: boolean;
  /**
   * The screen's existing network state. `null` means "not known yet", and it
   * is reused rather than re-derived so there is one listener, not two.
   */
  online?: boolean | null;
  /** Injected by tests. Production callers omit it and get the real client. */
  transport?: SyncTransport;
}): AccountSync {
  const [restoreNonce, setRestoreNonce] = useState(0);
  const [status, setStatus] = useState<SyncStatus>('idle');

  // Held in a ref so the scheduler never captures a stale one, and so a
  // re-render with a new object identity cannot restart the debounce.
  const transportRef = useRef<SyncTransport>(input.transport ?? REAL_SYNC_TRANSPORT);
  transportRef.current = input.transport ?? REAL_SYNC_TRANSPORT;

  /*
   * Everything the scheduler touches lives in a ref, so the effect below can
   * hold an empty dependency list without ever reading a stale value.
   */
  const enabledRef = useRef(input.enabled);
  enabledRef.current = input.enabled;
  const onlineRef = useRef(input.online ?? null);
  onlineRef.current = input.online ?? null;

  const pendingRef = useRef<Set<SyncDomain>>(new Set());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptRef = useRef(0);
  const flushingRef = useRef(false);
  const mountedRef = useRef(true);
  const reconciledRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  /** Set state only while mounted — a late retry must not touch a dead tree. */
  const safeSetStatus = useCallback((next: SyncStatus) => {
    if (mountedRef.current) setStatus(next);
  }, []);

  const flush = useCallback(async () => {
    timerRef.current = null;
    if (!enabledRef.current) return;
    // One flush at a time. A retry firing while a flush is in flight would
    // race two writes for the same row, and the loser would be refused by the
    // server-side freshness check anyway — so the cheap fix is not to start.
    if (flushingRef.current) return;

    const domains = [...pendingRef.current];
    if (domains.length === 0) {
      attemptRef.current = 0;
      return;
    }
    pendingRef.current = new Set();
    flushingRef.current = true;
    safeSetStatus('syncing');

    const failed: SyncDomain[] = [];
    for (const domain of domains) {
      // Read NOW, not when the edit happened. See the header.
      const snapshot = readLocalSnapshot(domain);
      if (snapshot === null) continue;
      let ok = false;
      try {
        // `pushDomain` re-reads the server row and refuses to replace a newer
        // one, so the conflict rule survives the debounce rather than holding
        // only at the moment the driver stopped typing.
        ok = await transportRef.current.push(domain, snapshot);
      } catch {
        ok = false;
      }
      /*
       * A refused-because-not-newer write and a failed write are both `false`
       * here, and they are treated the same: re-queued. That is the safe
       * direction. Re-queuing a write the server already has costs one round
       * trip that the freshness check refuses again; dropping a write that
       * genuinely failed costs the driver their data on the next device.
       *
       * The retry ladder is bounded, so a permanently-refused domain stops
       * after three attempts rather than spinning.
       */
      if (!ok) failed.push(domain);
    }

    flushingRef.current = false;
    if (!mountedRef.current) return;

    if (failed.length === 0) {
      attemptRef.current = 0;
      safeSetStatus('saved');
      return;
    }

    for (const d of failed) pendingRef.current.add(d);
    const delay = retryDelayFor(attemptRef.current);
    attemptRef.current += 1;
    if (delay === null) {
      // Ladder exhausted. The local record is complete and the driver is not
      // blocked — `syncFailureBlocksDriving()` is false and is called here so
      // that changing this behaviour means changing that function.
      safeSetStatus(
        syncFailureBlocksDriving() ? 'error' : onlineRef.current === false ? 'offline' : 'error',
      );
      return;
    }
    safeSetStatus(onlineRef.current === false ? 'offline' : 'syncing');
    clearTimer();
    timerRef.current = setTimeout(() => void flush(), delay);
  }, [clearTimer, safeSetStatus]);

  const notifySaved = useCallback(
    (domain: SyncDomain) => {
      /*
       * The write time is recorded EVEN WHEN SYNC IS OFF. It costs one small
       * record and it is what makes a later first sign-in able to order this
       * device's records against an account's — without it, everything saved
       * before the driver made an account would arrive timestamped zero and
       * lose every comparison it should have won.
       */
      markDomainSaved(domain, Date.now());
      if (!enabledRef.current) return;
      pendingRef.current.add(domain);
      // Restart the window: a burst of edits collapses into one write.
      clearTimer();
      attemptRef.current = 0;
      timerRef.current = setTimeout(() => void flush(), SYNC_DEBOUNCE_MS);
    },
    [clearTimer, flush],
  );

  const retryNow = useCallback(() => {
    if (!enabledRef.current) return;
    clearTimer();
    attemptRef.current = 0;
    void flush();
  }, [clearTimer, flush]);

  /* ---- first verified sign-in: reconcile once ---------------------------- */
  useEffect(() => {
    mountedRef.current = true;
    if (!input.enabled || reconciledRef.current) return;
    reconciledRef.current = true;

    let cancelled = false;
    void (async () => {
      try {
        const { decisions, cloud } = await transportRef.current.reconcile({
          local: readLocalSnapshots(),
          supportedVersion: SUPPORTED_PAYLOAD_VERSION,
        });
        if (cancelled || !mountedRef.current) return;

        let applied = 0;
        for (const domain of SYNC_DOMAINS) {
          if (decisions[domain] !== 'download') continue;
          const snapshot = cloud[domain];
          if (snapshot && applyDownloadedSnapshot(domain, snapshot)) applied += 1;
        }
        if (cancelled || !mountedRef.current) return;
        // Only nudge when something actually landed. An unconditional bump
        // would re-run every restore effect on every load for no reason.
        if (applied > 0) setRestoreNonce((n) => n + 1);
        setStatus('saved');
      } catch {
        // Fail soft, always. The device copy is intact and complete.
        if (!cancelled && mountedRef.current) setStatus('error');
      }
    })();

    return () => {
      cancelled = true;
    };
    // `enabled` only: this must run once per mount when sync turns on, and
    // nothing else in the closure is read after the first tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [input.enabled]);

  /* ---- teardown ---------------------------------------------------------- */
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = null;
    };
  }, []);

  return { restoreNonce, notifySaved, status, retryNow };
}
