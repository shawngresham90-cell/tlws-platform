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
 * Read a record's ENVELOPE, unparsed, for account sync.
 *
 * WHY RAW, WHEN EVERY OTHER READ IS SHAPE-CHECKED. Sync moves records
 * between a device and an account; it does not interpret them. Handing it
 * a parsed value would mean re-serializing on the way out, and the four
 * records' shapes would then be defined twice — once in the typed reader
 * and once in whatever sync reassembled. They would drift, and the drift
 * would show up as a field silently missing from the copy on a driver's
 * second phone.
 *
 * So sync carries the envelope through untouched, and PARSING STAYS WHERE
 * IT WAS: a downloaded record is written back with `writeRawVersioned`
 * and then read by the same typed reader as always, which re-applies
 * every rule — the truck's confirmation fingerprint, the clocks'
 * range re-validation, the strict booleans. A hostile or corrupt cloud
 * payload therefore gets exactly the same scrutiny as a hostile or
 * corrupt local one, because it goes through the same door.
 *
 * Returns null for a missing key, unreadable storage, bad JSON, a
 * non-object, or a version mismatch — the same "treated as absent"
 * discipline as `readVersioned`.
 */
export function readRawVersioned(
  key: string,
  version: number,
): { v: number; body: Record<string, unknown> } | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return null;
    const payload = parsed as Record<string, unknown>;
    if (payload.v !== version) return null;
    const { v: _v, ...body } = payload;
    return { v: version, body };
  } catch {
    return null;
  }
}

/**
 * Write a record's envelope back, for a sync download.
 *
 * The version is written from the ARGUMENT, not from the body, so a cloud
 * payload cannot smuggle a version number into a record and make a later
 * read accept something this build does not understand. The sync policy
 * refuses a payload newer than this build supports before it ever reaches
 * here; this is the second wall behind that one.
 */
export function writeRawVersioned(
  key: string,
  version: number,
  body: Record<string, unknown>,
): void {
  writeVersioned(key, version, body);
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
