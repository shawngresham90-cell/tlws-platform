'use client';

import { normalizeFirstName } from '@/lib/navigator/driver-greeting';
import { clearVersioned, readVersioned, writeVersioned } from './versioned-storage';

/**
 * The driver's first name, remembered on this device (pre-trip setup
 * milestone).
 *
 * IT USED TO BE DELIBERATELY EPHEMERAL. The screen said so — "Not saved —
 * re-enter it after a reload" — and that was the right call while the name
 * was a novelty. It is not the right call for a driver who opens Navigator
 * every morning and retypes their own name every morning. The owner asked
 * for it to persist; this is that, with the guard rails the old decision
 * was protecting.
 *
 * WHAT DID NOT CHANGE, AND MUST NOT:
 *   - The name is used for ONE thing: the spoken greeting and route-start
 *     line. It is not an account, not an identity, not a login.
 *   - It never reaches the network. Not the route request, not the
 *     search, not the problem report, not a log, not analytics. That is
 *     enforced by test across every module that could carry it.
 *   - It is never invented. A blank field stays blank and the greeting
 *     simply does not happen — `normalizeFirstName` is the same gate the
 *     entry form already used, applied again on the way OUT of storage so
 *     a hand-edited record cannot put anything into a driver's ear.
 *   - It is the driver's to erase, from the same screen, without clearing
 *     anything else.
 */

export const DRIVER_KEY = 'tlws-navigator-driver-v1';
const DRIVER_VERSION = 1;

/**
 * Read the saved name, re-validated.
 *
 * Re-validating on read is not paranoia about our own writer — it is the
 * only defence against a record edited by hand in devtools, and the value
 * goes to a speech synthesiser. A record that no longer looks like a first
 * name is treated as absent.
 */
export function readDriverName(): string | null {
  const stored = readVersioned<string>(DRIVER_KEY, DRIVER_VERSION, (payload) => {
    const result = normalizeFirstName(
      typeof payload.firstName === 'string' ? payload.firstName : null,
    );
    return result.ok ? result.firstName : null;
  });
  return stored.ok ? stored.value : null;
}

/**
 * Save a name that has already passed `normalizeFirstName`. Passing an
 * unvalidated string is a caller bug, so it is validated again here
 * rather than trusted — the cost is one regex and the benefit is that
 * this function cannot be the way something odd gets stored.
 */
export function writeDriverName(firstName: string): void {
  const result = normalizeFirstName(firstName);
  if (!result.ok) return;
  writeVersioned(DRIVER_KEY, DRIVER_VERSION, { firstName: result.firstName });
}

/** Forget the name. Nothing else is touched. */
export function clearDriverName(): void {
  clearVersioned(DRIVER_KEY);
}
