import { createAdminClient } from '@/lib/supabase/admin';
import type { MeteredEndpointKey } from './metered-endpoints';
import { readUsageConfig, usageMonthKey, weightFor, type ReservationOutcome } from './usage-guard';

/**
 * The centralized provider-usage guard — PLUMBING HALF.
 *
 * The rules live in `usage-guard.ts` and are not re-implemented here. This
 * file calls one Postgres function and translates its answer. It decides
 * nothing except what to do when the answer never arrives.
 *
 * ---------------------------------------------------------------------------
 * WHY THE SERVICE ROLE, AND WHY THAT IS NOT A LEAK
 *
 * The reservation runs with the service-role client, which is `server-only`
 * and can never be imported into a client component — the marketing export
 * already relies on exactly this. The browser never sees the key, never sees
 * the threshold, and never sees the remaining balance: the only thing that
 * crosses back to a driver is a boolean turned into a generic sentence.
 *
 * The alternative — reserving as the signed-in `authenticated` user, which
 * migration 051 also permits — was rejected for one reason: it would require
 * the route handler to hold a user-scoped client at the moment it reserves,
 * and a caller who can influence which client is used can influence which
 * identity is charged. The user id here comes from a verified `getUser()` and
 * is passed as a parameter, so there is exactly one place it can come from.
 *
 * ---------------------------------------------------------------------------
 * UNAVAILABLE MEANS REFUSED
 *
 * Missing environment, an unreachable database, an RPC that errors, a
 * response in a shape this code does not recognise — all of them return
 * `guard-unavailable`, and the caller refuses the request.
 *
 * This is the uncomfortable branch and it is the required one. A guard that
 * opens when its store is down is not a spending control; it is a spending
 * control that disables itself under precisely the conditions where nobody is
 * watching the dashboard. Refusing service is recoverable in a way that an
 * unbounded bill is not.
 */

type RpcRow = {
  allowed: boolean;
  reason: string;
  global_units: number;
  user_units: number;
};

/**
 * Reserve units for one metered request, atomically, before the provider is
 * called.
 *
 * NEVER REFUNDED. There is no counterpart to this function and there must not
 * be one — see `refundIsPermitted()` and the reasoning above it.
 */
export async function reserveProviderUnits(input: {
  endpoint: MeteredEndpointKey;
  userId: string;
  /** Injected so a test can drive month rollover without waiting for one. */
  nowMs?: number;
  env?: Record<string, string | undefined>;
}): Promise<ReservationOutcome> {
  const env = input.env ?? process.env;
  const parsed = readUsageConfig(env);
  if (!parsed.ok) return { allowed: false, reason: 'not-configured' };
  const config = parsed.config;

  const units = weightFor(config, input.endpoint);
  const month = usageMonthKey(input.nowMs ?? Date.now());

  let admin;
  try {
    admin = createAdminClient();
  } catch {
    // No URL or no service-role key in this deploy context. Indistinguishable
    // from a store that is down, and treated the same way.
    return { allowed: false, reason: 'guard-unavailable' };
  }

  try {
    const { data, error } = await admin.rpc('navigator_reserve_provider_units', {
      p_user_id: input.userId,
      p_endpoint: input.endpoint,
      p_units: units,
      p_month: month,
      p_global_threshold: config.threshold,
      p_user_limit: config.userLimit,
    });

    if (error) return { allowed: false, reason: 'guard-unavailable' };

    // `returns table` arrives as an array of one row. Anything else — an empty
    // array, a null, an object without the fields — is a shape this code does
    // not understand, and guessing at it would be guessing about money.
    const row = Array.isArray(data) ? (data[0] as RpcRow | undefined) : undefined;
    if (!row || typeof row.allowed !== 'boolean') {
      return { allowed: false, reason: 'guard-unavailable' };
    }

    if (row.allowed) {
      return {
        allowed: true,
        units,
        globalUnits: Number(row.global_units) || 0,
        userUnits: Number(row.user_units) || 0,
      };
    }

    // The function's own vocabulary, mapped onto the policy's. An unrecognized
    // reason is treated as unavailable rather than as a clean refusal, because
    // the two lead to different operator actions and guessing picks the wrong
    // one silently.
    if (row.reason === 'user-limit') return { allowed: false, reason: 'user-limit' };
    if (row.reason === 'global-threshold') return { allowed: false, reason: 'global-threshold' };
    return { allowed: false, reason: 'guard-unavailable' };
  } catch {
    return { allowed: false, reason: 'guard-unavailable' };
  }
}
