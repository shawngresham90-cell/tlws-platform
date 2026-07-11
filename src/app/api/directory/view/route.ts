import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Most-viewed ingestion (Milestone 25) — the FOUNDATION only.
 *
 * Privacy & abuse posture (see docs/most-viewed-privacy.md):
 *   - Accepts only a listing id. No IP, user agent, referrer, or location is
 *     ever stored. The client IP is used transiently for in-memory rate
 *     limiting and is never persisted or logged.
 *   - Best-effort per-IP + global rate limiting drops floods and obvious bots
 *     before any write, so one client cannot inflate a count.
 *   - The write is a single atomic daily-counter increment via a SECURITY
 *     DEFINER function; there is no per-user row.
 *   - Fails soft: if migration 025 is unapplied (function/table absent), this
 *     still returns 204 and records nothing. Nothing is public — counts are
 *     admin-only until a deliberate future decision.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// In-memory sliding window. Per-instance and intentionally forgetful — a
// backstop against floods, not a security boundary (the DB increment is
// idempotent-ish per day and unprivileged callers can't read counts anyway).
const WINDOW_MS = 60_000;
const PER_IP_MAX = 20; // views/minute/ip
const GLOBAL_MAX = 2000; // views/minute/instance
const ipHits = new Map<string, { n: number; resetAt: number }>();
let globalHits = { n: 0, resetAt: 0 };

function allow(ip: string, now: number): boolean {
  if (now > globalHits.resetAt) globalHits = { n: 0, resetAt: now + WINDOW_MS };
  if (++globalHits.n > GLOBAL_MAX) return false;
  const cur = ipHits.get(ip);
  if (!cur || now > cur.resetAt) {
    ipHits.set(ip, { n: 1, resetAt: now + WINDOW_MS });
    if (ipHits.size > 10_000) ipHits.clear(); // bound memory
    return true;
  }
  cur.n += 1;
  return cur.n <= PER_IP_MAX;
}

export async function POST(req: Request): Promise<Response> {
  // Same-origin only — a cheap bot/csrf filter for a fire-and-forget beacon.
  const secFetchSite = req.headers.get('sec-fetch-site');
  if (secFetchSite && secFetchSite !== 'same-origin') {
    return new NextResponse(null, { status: 204 });
  }

  let id: unknown;
  try {
    id = (await req.json())?.id;
  } catch {
    return new NextResponse(null, { status: 204 });
  }
  if (typeof id !== 'string' || !UUID.test(id)) {
    return new NextResponse(null, { status: 204 });
  }

  // Transient, non-persisted IP for rate limiting only.
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip') ||
    'unknown';
  if (!allow(ip, Date.now())) {
    return new NextResponse(null, { status: 204 });
  }

  try {
    const supabase = createAdminClient();
    await supabase.rpc('record_directory_view', { p_location: id });
  } catch {
    // Migration 025 unapplied or DB hiccup — record nothing, never error out.
  }
  return new NextResponse(null, { status: 204 });
}
