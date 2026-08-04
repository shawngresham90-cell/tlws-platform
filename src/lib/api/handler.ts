import { NextRequest } from 'next/server';
import { z } from 'zod';
import { fail } from './responses';
import { rateLimit, clientIp } from './rate-limit';
import { verifyTurnstile } from './turnstile';
import { log } from './logger';

type GuardedContext<T> = {
  data: T;
  ip: string;
  req: NextRequest;
};

type Options = {
  rateLimitMax?: number;
  rateLimitWindowMs?: number;
  requireTurnstile?: boolean;
  routeKey: string;
};

/**
 * Wraps a public POST route with the full guard stack in order:
 *   1. rate limit (IP + route)
 *   2. JSON parse
 *   3. zod validation
 *   4. Turnstile verification (if the schema carries a token)
 *   5. hand validated data to the business logic
 * Any throw becomes a clean 500 without leaking internals.
 */
export function guardedPost<S extends z.ZodTypeAny>(
  schema: S,
  opts: Options,
  handler: (ctx: GuardedContext<z.infer<S>>) => Promise<Response>,
) {
  return async (req: NextRequest): Promise<Response> => {
    const ip = clientIp(req.headers);

    const rl = rateLimit(
      `${opts.routeKey}:${ip}`,
      opts.rateLimitMax ?? 5,
      opts.rateLimitWindowMs ?? 60_000,
    );
    if (!rl.allowed)
      return fail('Too many requests. Slow down and try again.', 429, 'rate_limited');

    let json: unknown;
    try {
      json = await req.json();
    } catch {
      return fail('Invalid request body.', 400, 'bad_json');
    }

    const parsed = schema.safeParse(json);
    if (!parsed.success) {
      const first = parsed.error.issues[0];
      return fail(first?.message ?? 'Validation failed.', 422, 'validation');
    }

    // Turnstile. Two modes, and the difference is the whole point:
    //
    //   requireTurnstile: true   — STRICT. A missing token is a failed
    //     verification. Without this, a bot that simply OMITS the token
    //     field walks past a `.optional()` schema and the widget-wired form
    //     is protected against everyone except the abusers. Environment
    //     awareness lives in verifyTurnstile: dev without a secret still
    //     skips, production without a secret fails closed (same policy the
    //     apply route already has via its schema-required token).
    //
    //   default ("if present") — verify a token when one arrives, allow
    //     when absent. Only correct for routes whose form has no widget yet;
    //     routes that render the widget should be strict.
    const maybeToken = (parsed.data as { turnstileToken?: string }).turnstileToken;
    if (opts.requireTurnstile === true) {
      const okToken = await verifyTurnstile(maybeToken ?? '', ip);
      if (!okToken) return fail('Verification failed. Reload and try again.', 403, 'turnstile');
    } else if (opts.requireTurnstile !== false && maybeToken) {
      const okToken = await verifyTurnstile(maybeToken, ip);
      if (!okToken) return fail('Verification failed. Reload and try again.', 403, 'turnstile');
    }

    try {
      return await handler({ data: parsed.data, ip, req });
    } catch (err) {
      log.error('handler_error', { route: opts.routeKey, message: (err as Error).message });
      return fail('Something went wrong on our end. Try again shortly.', 500, 'server_error');
    }
  };
}
