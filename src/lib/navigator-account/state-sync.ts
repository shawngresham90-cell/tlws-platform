/**
 * Which copy wins — the phone's or the account's.
 *
 * Pure. Both sides arrive as arguments, including every timestamp, so the
 * whole decision table can be proved without a database or a clock. That
 * matters here more than the plumbing does: the plumbing failing is visible,
 * and this failing is not. A wrong answer silently replaces a driver's truck
 * with an older one, and they find out at a scale house.
 *
 * THE RULE, in one sentence: newer wins, per domain, and a tie changes
 * nothing.
 *
 * PER DOMAIN, not per driver. The four records are synced independently
 * because they are edited independently — a driver who adjusts their clocks
 * on a phone and their truck on a tablet has newer copies of different things
 * in different places, and a whole-account "last device wins" would throw one
 * of them away. This is the same independence the local storage layer was
 * built for, and the migration keeps four rows rather than one blob to
 * preserve it.
 *
 * TIES CHANGE NOTHING, deliberately. Equal timestamps mean the two copies are
 * the same age and there is no evidence either is newer. Picking one would be
 * a coin flip that looks like a decision; doing nothing leaves the driver
 * with what they already had, which is the answer they can predict.
 *
 * NOTHING LOCATION-SHAPED SYNCS. The four domains are the whole list, and it
 * is the same list the database enforces with a check constraint. No
 * position, no destination, no search, no route, no movement history — none
 * of it is stored server-side at all.
 */

export const SYNC_DOMAINS = ['truck', 'route_prefs', 'hos_clocks', 'onboarding'] as const;
export type SyncDomain = (typeof SYNC_DOMAINS)[number];

/** One side's copy of a record. */
export type SyncSnapshot = {
  payload: Record<string, unknown>;
  /** The local record's schema version, carried so a reader can refuse it. */
  payloadVersion: number;
  /** Epoch ms. The only thing the conflict rule reads. */
  updatedAtMs: number;
};

export type SyncDecision =
  /** Local is newer, or cloud has nothing: send it up. */
  | 'upload'
  /** Cloud is newer, or local has nothing: bring it down. */
  | 'download'
  /** Same age, or genuinely equal: leave both alone. */
  | 'in-sync'
  /** Neither side has anything to sync. */
  | 'nothing'
  /**
   * Cloud holds a payload written by a NEWER app version than this one
   * understands. Refused rather than coerced — see below.
   */
  | 'cloud-too-new';

/**
 * Decide one domain.
 *
 * `supportedVersion` is the highest payload version this build can parse. A
 * cloud row above it is refused rather than downloaded, because the
 * alternative is worse in a specific way: a phone running an old build would
 * read a record it half-understands, write back its own reduced version, and
 * the fields it never knew about would be gone from the account for every
 * other device too. Refusing costs this device a sync; coercing costs the
 * driver data on all of them.
 *
 * The reverse — local newer than cloud understands — is not a case. The cloud
 * stores what it is given and the version rides along with it.
 */
export function decideSync(input: {
  local: SyncSnapshot | null;
  cloud: SyncSnapshot | null;
  supportedVersion: number;
}): SyncDecision {
  const { local, cloud, supportedVersion } = input;

  if (local === null && cloud === null) return 'nothing';

  if (cloud !== null && cloud.payloadVersion > supportedVersion) return 'cloud-too-new';

  // First sign-in on a device that has been used offline.
  if (cloud === null) return 'upload';

  // First sign-in on a fresh device: the account is the only copy.
  if (local === null) return 'download';

  if (local.updatedAtMs > cloud.updatedAtMs) return 'upload';
  if (cloud.updatedAtMs > local.updatedAtMs) return 'download';
  return 'in-sync';
}

/**
 * Decide every domain at once — what the first verified sign-in runs.
 *
 * Returns a decision per domain rather than one verdict, which is the whole
 * point: cloud-empty-and-local-present uploads, local-empty-and-cloud-present
 * downloads, and a driver with newer clocks here and a newer truck there gets
 * both, not whichever device asked last.
 */
export function decideAllDomains(input: {
  local: Partial<Record<SyncDomain, SyncSnapshot>>;
  cloud: Partial<Record<SyncDomain, SyncSnapshot>>;
  supportedVersion: number;
}): Record<SyncDomain, SyncDecision> {
  const out = {} as Record<SyncDomain, SyncDecision>;
  for (const domain of SYNC_DOMAINS) {
    out[domain] = decideSync({
      local: input.local[domain] ?? null,
      cloud: input.cloud[domain] ?? null,
      supportedVersion: input.supportedVersion,
    });
  }
  return out;
}

/**
 * Is this upload still safe to send?
 *
 * Checked immediately before the write, against the row the server currently
 * holds — because a debounce means time passes between deciding to upload and
 * uploading, and another device may have written in the gap. Without this the
 * conflict rule holds only at decision time, which is exactly when it is not
 * being tested.
 *
 * This is the guarantee that "never silently replace newer information with
 * older information" survives a race rather than merely a comparison.
 */
export function uploadStillSafe(input: {
  candidate: SyncSnapshot;
  serverNow: SyncSnapshot | null;
}): boolean {
  if (input.serverNow === null) return true;
  return input.candidate.updatedAtMs > input.serverNow.updatedAtMs;
}

/**
 * How long to wait after a change before writing to the cloud.
 *
 * A driver adjusting clocks moves through several intermediate values in a
 * few seconds, and each one is not worth a round trip. Long enough to
 * collapse a burst of edits into one write; short enough that closing the tab
 * shortly after a change does not usually lose it.
 */
export const SYNC_DEBOUNCE_MS = 4000;

/** Backoff for a failed write. Bounded, and it never blocks the driver. */
export const SYNC_RETRY_DELAYS_MS = [5000, 15_000, 60_000] as const;

export function retryDelayFor(attempt: number): number | null {
  if (attempt < 0) return null;
  return attempt < SYNC_RETRY_DELAYS_MS.length ? SYNC_RETRY_DELAYS_MS[attempt] : null;
}

/**
 * What the driver is told, and where.
 *
 * `syncing` and `error` are NEVER surfaced on the driving surface. A sync
 * failure is not a driving problem: the local copy is intact, the route is
 * unaffected, and a message about it while someone is moving is a distraction
 * with no action attached. The status lives on the Account screen, which is
 * where a driver can actually do something about it.
 */
export type SyncStatus = 'idle' | 'syncing' | 'saved' | 'offline' | 'error';

export const SYNC_STATUS_TEXT: Record<SyncStatus, string> = {
  idle: 'Nothing to save.',
  syncing: 'Saving to your account…',
  saved: 'Saved to your account.',
  offline: 'Saved on this device. It will reach your account when you have signal.',
  error: 'Saved on this device. We could not reach your account — try again.',
};

/**
 * Does a sync failure block starting a route? No, and this is the function
 * that says so out loud so a future caller has to argue with a name rather
 * than with a comment.
 *
 * The local record is written first and is complete on its own. Cloud
 * persistence is a convenience for the driver's next device, and a
 * convenience must never stand between a driver and a route.
 */
export function syncFailureBlocksDriving(): false {
  return false;
}
