'use client';

/**
 * The one place the Navigator touches device storage (pre-trip setup
 * milestone).
 *
 * WHY IT IS ONE PLACE. The setup flow now remembers three independent
 * things across visits — the driver's name, their truck, and their
 * hours-of-service clocks — and the requirement that matters most is that
 * they fail INDEPENDENTLY. A corrupt clock record must not cost a driver
 * the truck they verified, and neither may cost them a trip they are in
 * the middle of. That is only structurally true if each record lives
 * under its own key behind its own parser, and the easiest way to get
 * that wrong is to hand-roll try/catch four times. So the envelope, the
 * version check, the quota failure and the "storage is unavailable at all"
 * case are written once, here, and each record supplies only its own
 * shape check.
 *
 * WHY localStorage. "Restore it after reload and future visits" is not
 * something sessionStorage can do — it dies with the tab. A driver who
 * closes Navigator at a truck stop and reopens it in the morning must not
 * re-enter their truck. The TRIP snapshot deliberately stays in
 * sessionStorage (it is about one drive, and it should not outlive the
 * tab); these three are about the DRIVER, and they should.
 *
 * WHAT MAY NEVER GO IN HERE. No position, no position history, no
 * searched address, no destination, no route, no provider credential.
 * The records below hold a first name, truck dimensions, and four
 * integers of clock time. That list is enforced by test, not by habit.
 */

/** A stored record that failed to parse is treated as absent, never as a default. */
export type StoredResult<T> = { ok: true; value: T } | { ok: false };

const MISSING: StoredResult<never> = Object.freeze({ ok: false });

/**
 * Read one versioned record. Anything unexpected — no storage, no key,
 * bad JSON, wrong version, failed shape check — returns `{ok:false}`, and
 * the caller falls back to its own default. It never throws, and it never
 * touches any key but its own.
 */
export function readVersioned<T>(
  key: string,
  version: number,
  shape: (payload: Record<string, unknown>) => T | null,
): StoredResult<T> {
  if (typeof window === 'undefined') return MISSING;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return MISSING;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return MISSING;
    const payload = parsed as Record<string, unknown>;
    if (payload.v !== version) return MISSING;
    const value = shape(payload);
    return value === null ? MISSING : { ok: true, value };
  } catch {
    // Storage disabled, private-mode quota, or a hand-edited value. The
    // driver is not shown an error for this: the setup screen simply asks
    // again, which is the same thing it does for a first-time driver.
    return MISSING;
  }
}

/**
 * Write one versioned record. A failure is swallowed on purpose — a
 * preference that cannot be stored is still usable for this session, and
 * a storage quota is not a reason to interrupt a driver who is trying to
 * leave.
 */
export function writeVersioned(key: string, version: number, body: Record<string, unknown>): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify({ v: version, ...body }));
  } catch {
    /* unusable storage is not an error the driver can act on */
  }
}

/** Forget one record. Used by the explicit clear controls, never automatically. */
export function clearVersioned(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* nothing to do and nothing to say */
  }
}

/**
 * Read a record that an earlier build wrote to sessionStorage, so a
 * driver mid-pilot does not lose what they already verified when this
 * change ships. Read-only and one-way: the caller re-writes it through
 * `writeVersioned`, and the old copy is then removed.
 */
export function readLegacySession<T>(
  key: string,
  version: number,
  shape: (payload: Record<string, unknown>) => T | null,
): StoredResult<T> {
  if (typeof window === 'undefined') return MISSING;
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw === null) return MISSING;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return MISSING;
    const payload = parsed as Record<string, unknown>;
    if (payload.v !== version) return MISSING;
    const value = shape(payload);
    return value === null ? MISSING : { ok: true, value };
  } catch {
    return MISSING;
  }
}

/** Drop a migrated legacy record so the migration runs exactly once. */
export function clearLegacySession(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    /* the copy in localStorage is authoritative either way */
  }
}
