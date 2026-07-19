import 'server-only';
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type ServerSupabase = ReturnType<typeof createClient>;

/**
 * Server-only auth helper for the cloud-sync API routes. Identity ALWAYS comes
 * from the authenticated Supabase session (`auth.getUser()`), never from the
 * request body — a client cannot assert someone else's user_id. The anon key +
 * user cookies mean RLS also enforces owner-only access as defense in depth.
 * The service role is never used here. Row mappers live in `cloud-sync.ts` so
 * they stay pure and offline-testable.
 */

export type Authed = {
  supabase: ServerSupabase;
  userId: string;
};

/** Resolve the signed-in user, or a ready-to-return 401. */
export async function requireUser(): Promise<Authed | { response: NextResponse }> {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return {
      response: NextResponse.json(
        { ok: false, error: { code: 'unauthenticated', message: 'Sign in to sync.' } },
        { status: 401 },
      ),
    };
  }
  return { supabase, userId: user.id };
}
