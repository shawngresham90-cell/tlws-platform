import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import type { z } from 'zod';
import { RateLimiter } from './rate-limit';

/**
 * Shared API-layer plumbing for the trip-planner endpoints (Phase 4):
 * per-IP rate limiting, body-size caps, zod validation, and uniform error
 * shapes. The planner API is public and read-only (it never writes), so
 * abuse protection = rate limit + strict validation + bounded inputs.
 */

const limiter = new RateLimiter({
  capacity: 20,
  refillPerSecond: 20 / 60, // 20 requests/minute per IP, per instance
  nowMs: () => Date.now(),
});

export const MAX_BODY_BYTES = 512 * 1024;

export function clientKey(req: NextRequest): string {
  // Netlify's own client-IP header first. Falling back to x-forwarded-for,
  // take the LAST entry — that one was appended by the edge proxy; earlier
  // entries are client-supplied and trivially spoofable.
  const xff = req.headers.get('x-forwarded-for');
  const lastHop = xff?.split(',').pop()?.trim();
  return req.headers.get('x-nf-client-connection-ip') ?? (lastHop || 'unknown');
}

export function errorJson(status: number, code: string, message: string, problems?: string[]) {
  return NextResponse.json({ ok: false, error: { code, message, problems } }, { status });
}

/**
 * Guard + parse a POST body: rate limit → size cap → JSON → schema. Returns
 * either the parsed data or a ready-to-return error response.
 */
export async function guardedParse<S extends z.ZodTypeAny>(
  req: NextRequest,
  schema: S,
): Promise<{ data: z.output<S> } | { response: NextResponse }> {
  if (!limiter.allow(clientKey(req))) {
    return { response: errorJson(429, 'rate-limited', 'Too many requests — slow down.') };
  }
  // Reject oversized bodies before reading them when the client declares a
  // length; re-check in bytes (not UTF-16 code units) after reading.
  const declared = Number(req.headers.get('content-length') ?? '');
  if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
    return { response: errorJson(413, 'too-large', 'Request body too large.') };
  }
  let text: string;
  try {
    text = await req.text();
  } catch {
    return { response: errorJson(400, 'bad-body', 'Could not read request body.') };
  }
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) {
    return { response: errorJson(413, 'too-large', 'Request body too large.') };
  }
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { response: errorJson(400, 'bad-json', 'Body must be valid JSON.') };
  }
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return {
      response: errorJson(
        422,
        'invalid-input',
        'Request failed validation.',
        parsed.error.issues.slice(0, 10).map((i) => `${i.path.join('.')}: ${i.message}`),
      ),
    };
  }
  return { data: parsed.data };
}
