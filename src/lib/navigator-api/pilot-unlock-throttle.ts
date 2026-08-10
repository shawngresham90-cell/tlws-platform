/**
 * Brute-force throttle for the Navigator pilot password.
 *
 * THE GAP THIS CLOSES
 *
 * Every other Navigator surface is rate limited. The route endpoint allows
 * six requests an hour per IP; destination search allows thirty a minute.
 * The password form — the single control standing between the open
 * internet and truck guidance, and between the open internet and provider
 * spend — allowed unlimited attempts at whatever rate a server would
 * accept them.
 *
 * The comparison itself is constant-time, so the password does not leak
 * through timing. That defends against a subtle attack while leaving the
 * obvious one wide open: a shared static secret with no lockout, no
 * throttle and no delay is guessable at line rate, and nothing anywhere
 * would have noticed it happening.
 *
 * ORDERING: THE TOKEN IS SPENT BEFORE THE PASSWORD IS CHECKED
 *
 * A correct submission consumes a token exactly like a wrong one. That
 * costs a legitimate driver nothing they will notice and it removes an
 * oracle: if only failures were throttled, the presence or absence of
 * throttling would itself answer "was that guess right?".
 *
 * PER-IP ONLY, DELIBERATELY — NO GLOBAL CAP
 *
 * A global attempt ceiling would be strictly better against a distributed
 * attack and strictly worse for the pilot: anyone could exhaust it and
 * lock out the two or three drivers who actually need in. Turning a
 * brute-force attempt into a denial of service against the people driving
 * is the wrong trade for a pilot this size. Per-IP buckets mean a flood
 * only ever locks out the flooder.
 *
 * KNOWN LIMITATION, STATED RATHER THAN IMPLIED
 *
 * The bucket store is in-memory, so on serverless the cap is per warm
 * instance, not global — the same limitation the planner's and the route
 * endpoint's limiters already document. An attacker spread across many
 * cold starts gets more than eight attempts. This is a large improvement
 * on unlimited and is not a complete defence; the complete defence is a
 * password long enough that a few hundred attempts an hour is irrelevant,
 * which is an operational decision recorded in the pilot documents.
 */

import { RateLimiter } from '@/lib/trip-planner/rate-limit';

/**
 * Attempts available in a burst.
 *
 * Eight, because a driver typing a shared password into a phone keyboard
 * gets it wrong more than twice — autocorrect capitalises it, the space
 * bar inserts one, the field is masked so they cannot see why. Eight is
 * comfortably past ordinary human fumbling and nowhere near useful for
 * guessing.
 */
export const UNLOCK_BURST = 8;

/**
 * Seconds to earn one attempt back. Ninety seconds sustains 40 attempts an
 * hour from one address — irrelevant against any real password, and
 * survivable for a driver who has genuinely forgotten it and is waiting on
 * a text.
 */
export const UNLOCK_REFILL_SECONDS = 90;

/** The error code the password screen renders. Never says why it failed. */
export const UNLOCK_THROTTLED = 'throttled';

const limiter = new RateLimiter({
  capacity: UNLOCK_BURST,
  refillPerSecond: 1 / UNLOCK_REFILL_SECONDS,
  nowMs: () => Date.now(),
});

/**
 * The bucket key for a request.
 *
 * Mirrors `clientKey` in the API utilities rather than importing it, which
 * takes a NextRequest a server action does not have. The rule is the same
 * and it matters: with `x-forwarded-for`, take the LAST entry. That hop
 * was appended by the edge proxy; earlier entries are client-supplied and
 * trivially spoofable, so keying on the first would let an attacker mint a
 * fresh bucket per attempt by changing a header.
 */
export function unlockClientKey(headers: { get(name: string): string | null | undefined }): string {
  const direct = headers.get('x-nf-client-connection-ip');
  if (typeof direct === 'string' && direct.trim() !== '') return direct.trim();
  const xff = headers.get('x-forwarded-for');
  const lastHop = typeof xff === 'string' ? xff.split(',').pop()?.trim() : undefined;
  return lastHop && lastHop !== '' ? lastHop : 'unknown';
}

/**
 * Spend one attempt. True when the attempt may proceed to the password
 * comparison; false when this address has spent its burst.
 */
export function allowUnlockAttempt(key: string): boolean {
  return limiter.allow(key);
}
