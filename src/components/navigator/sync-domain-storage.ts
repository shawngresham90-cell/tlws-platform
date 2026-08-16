'use client';

import {
  SYNC_DOMAINS,
  type SyncDomain,
  type SyncSnapshot,
} from '@/lib/navigator-account/state-sync';
import {
  clearVersioned,
  readRawVersioned,
  readVersioned,
  writeRawVersioned,
  writeVersioned,
} from './versioned-storage';
import { TRUCK_PROFILE_KEY, TRUCK_VERSION } from './truck-storage';
import { ROUTE_PREFS_KEY, ROUTE_PREFS_VERSION } from './route-prefs-storage';
import { CLOCKS_KEY, CLOCKS_VERSION } from './clocks-storage';
import { ONBOARDING_KEY, ONBOARDING_VERSION } from './onboarding-storage';

/**
 * The bridge between the four device records and the four cloud rows.
 *
 * It knows two things nothing else does: WHICH local key backs each sync
 * domain, and WHEN each record was last written. Everything else — the
 * conflict rule, the network, the debounce — lives elsewhere.
 *
 * ---------------------------------------------------------------------------
 * WHY A SEPARATE TIMESTAMP RECORD, AND NOT A FIELD ON EACH RECORD
 *
 * The conflict rule needs a per-domain `updated_at`. None of the four local
 * records carries one, and adding a field would mean bumping each record's
 * version — which, by the deliberate design of `readVersioned`, makes every
 * existing record UNREADABLE and therefore absent. Every pilot driver would
 * open the Navigator to an empty truck form and be asked to re-verify a truck
 * they verified weeks ago. That is a real cost paid by real people to make an
 * internal refactor tidier, and it is not worth it.
 *
 * So the write times live in their own record beside the four, under their own
 * key, with their own version — the same "one record, one key, one parser,
 * failing independently" discipline as everything else in this directory. A
 * damaged marks record costs the driver accurate sync ordering and nothing
 * else: the four records themselves are untouched and still load.
 *
 * ---------------------------------------------------------------------------
 * AN UNMARKED RECORD IS TIMESTAMPED ZERO, NOT `NOW`
 *
 * A driver upgrading into this build has four records and no marks. The
 * question is what age to claim for them, and the two candidates fail in
 * opposite directions:
 *
 *   `now`  — the local copy is treated as the newest thing in existence. If
 *            the driver had already set up their truck on a second device and
 *            it is sitting in the account, this device's stale copy wins and
 *            OVERWRITES IT. That is precisely the "silently replace newer
 *            information with older" failure the whole conflict rule exists
 *            to prevent, and it would fire exactly once per driver, invisibly,
 *            at upgrade.
 *
 *   `0`    — the local copy is treated as the oldest thing in existence. If
 *            the account is empty, `decideSync` still uploads it (local
 *            present, cloud absent — the timestamp is not consulted), so
 *            nothing is lost. If the account holds a copy, that copy wins,
 *            which is the correct answer whenever we cannot show ours is
 *            newer.
 *
 * Zero is therefore not a guess at the age; it is the honest statement that we
 * do not know one, expressed in the only units the comparison speaks. The
 * record earns a real timestamp the first time the driver saves it.
 */

export const SYNC_MARKS_KEY = 'tlws-navigator-sync-marks-v1';
const SYNC_MARKS_VERSION = 1;

/**
 * Which local record backs each cloud domain.
 *
 * The keys and versions are IMPORTED from the modules that own them rather
 * than repeated here, so a version bump in one place cannot leave this map
 * pointing at a record shape that no longer exists.
 */
export const SYNC_DOMAIN_RECORDS: Readonly<
  Record<SyncDomain, { readonly key: string; readonly version: number }>
> = {
  truck: { key: TRUCK_PROFILE_KEY, version: TRUCK_VERSION },
  route_prefs: { key: ROUTE_PREFS_KEY, version: ROUTE_PREFS_VERSION },
  hos_clocks: { key: CLOCKS_KEY, version: CLOCKS_VERSION },
  onboarding: { key: ONBOARDING_KEY, version: ONBOARDING_VERSION },
};

/**
 * The highest payload version this build understands, across all domains.
 * A cloud row above it is refused rather than coerced — see `decideSync`.
 */
export const SUPPORTED_PAYLOAD_VERSION = Math.max(
  ...SYNC_DOMAINS.map((d) => SYNC_DOMAIN_RECORDS[d].version),
);

type Marks = Partial<Record<SyncDomain, number>>;

function shapeMarks(payload: Record<string, unknown>): Marks | null {
  const raw = payload.marks;
  if (raw === null || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const out: Marks = {};
  for (const domain of SYNC_DOMAINS) {
    const v = source[domain];
    // Strict: a non-number, a negative, a NaN is not a write time and is not
    // coerced into one. An absent mark reads as zero, which is the safe end.
    if (typeof v === 'number' && Number.isFinite(v) && v > 0) out[domain] = v;
  }
  return out;
}

/** Every known write time. Empty on any failure. */
export function readSyncMarks(): Marks {
  const read = readVersioned<Marks>(SYNC_MARKS_KEY, SYNC_MARKS_VERSION, shapeMarks);
  return read.ok ? read.value : {};
}

/**
 * Record that a domain was just written.
 *
 * Read-modify-write of the marks record only. It never touches the four data
 * records, so a failure here cannot damage a truck profile.
 */
export function markDomainSaved(domain: SyncDomain, atMs: number): void {
  if (!Number.isFinite(atMs) || atMs <= 0) return;
  const marks = readSyncMarks();
  marks[domain] = atMs;
  writeVersioned(SYNC_MARKS_KEY, SYNC_MARKS_VERSION, { marks });
}

/** Forget the write times. Used only by an explicit sign-out or clear. */
export function clearSyncMarks(): void {
  clearVersioned(SYNC_MARKS_KEY);
}

/**
 * One domain's local copy, as the conflict rule wants to see it — or null if
 * this device has no record for it.
 */
export function readLocalSnapshot(domain: SyncDomain): SyncSnapshot | null {
  const record = SYNC_DOMAIN_RECORDS[domain];
  const raw = readRawVersioned(record.key, record.version);
  if (raw === null) return null;
  return {
    payload: raw.body,
    payloadVersion: raw.v,
    // Zero for an unmarked record. See the header for why this is the safe
    // end of the range and `now` is the dangerous one.
    updatedAtMs: readSyncMarks()[domain] ?? 0,
  };
}

/** Every local copy this device holds. Domains with no record are absent. */
export function readLocalSnapshots(): Partial<Record<SyncDomain, SyncSnapshot>> {
  const marks = readSyncMarks();
  const out: Partial<Record<SyncDomain, SyncSnapshot>> = {};
  for (const domain of SYNC_DOMAINS) {
    const record = SYNC_DOMAIN_RECORDS[domain];
    const raw = readRawVersioned(record.key, record.version);
    if (raw === null) continue;
    out[domain] = {
      payload: raw.body,
      payloadVersion: raw.v,
      updatedAtMs: marks[domain] ?? 0,
    };
  }
  return out;
}

/**
 * Apply a downloaded record to this device.
 *
 * Returns false — and writes nothing — when the payload's version is not the
 * one this build stores for that domain. The sync policy already refuses a
 * too-new payload before this is called; this is the second wall, and it also
 * catches a payload that is too OLD, which the policy deliberately does not
 * treat as an error.
 *
 * THE WRITE GOES THROUGH THE ORDINARY ENVELOPE, so the next read of this
 * record runs the same parser, the same shape check and the same
 * re-validation as any locally written one. A cloud truck whose confirmation
 * fingerprint no longer matches its values comes back UNCONFIRMED and Start
 * stays disabled — restoring a truck must never restore permission to route
 * for a truck nobody checked, and that rule is not re-implemented here
 * because it does not have to be.
 */
export function applyDownloadedSnapshot(domain: SyncDomain, snapshot: SyncSnapshot): boolean {
  const record = SYNC_DOMAIN_RECORDS[domain];
  if (snapshot.payloadVersion !== record.version) return false;
  writeRawVersioned(record.key, record.version, snapshot.payload);
  // The mark is the CLOUD's write time, not now. Stamping it `now` would make
  // a freshly downloaded copy look newer than the account row it came from,
  // and the next debounce would upload it straight back — a write loop that
  // costs a round trip every time a driver opens the app.
  markDomainSaved(domain, snapshot.updatedAtMs);
  return true;
}
