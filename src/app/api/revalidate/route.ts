import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { ok, fail } from '@/lib/api/responses';
import { log } from '@/lib/api/logger';

export const runtime = 'nodejs';

/**
 * On-demand revalidation — PLACEHOLDER wired for real use. Protected by a
 * shared secret (REVALIDATE_SECRET) so only trusted callers (e.g. the Stripe
 * webhook, content-sync scripts) can bust a path's cache. Used later to make
 * founder #24 appear on /founders seconds after payment.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATE_SECRET;
  const provided = req.headers.get('x-revalidate-secret');

  if (!secret) {
    log.info('revalidate_placeholder_no_secret');
    return ok({ revalidated: false, reason: 'placeholder' });
  }
  if (provided !== secret) {
    log.warn('revalidate_unauthorized');
    return fail('Unauthorized.', 401, 'unauthorized');
  }

  let path: string | undefined;
  try {
    ({ path } = (await req.json()) as { path?: string });
  } catch {
    return fail('Invalid body.', 400, 'bad_json');
  }
  if (!path || !path.startsWith('/')) return fail('A valid path is required.', 422, 'bad_path');

  revalidatePath(path);
  log.info('revalidated', { path });
  return ok({ revalidated: true, path });
}
