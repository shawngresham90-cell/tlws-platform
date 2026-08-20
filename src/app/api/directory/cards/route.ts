import { z } from 'zod';
import { guardedGet } from '@/lib/api/handler';
import { getEntriesByIdsResult, CARD_LOOKUP_MAX_IDS } from '@/lib/directory/data';
import { toCardEntry } from '@/lib/directory/dto';
import { ok, fail } from '@/lib/api/responses';

export const runtime = 'nodejs';

/**
 * Card fields for a bounded set of listing ids (DIR-PAYLOAD-1).
 *
 * A category page ships a compact index of EVERY listing — enough to search,
 * filter, sort and count the complete set in the browser — and server-renders
 * the first window of cards. This route answers the windows after that: the
 * ids the browser is about to render, and nothing else.
 *
 * What this route is NOT: a search endpoint. It takes ids the page already
 * holds, never a query, so no typed text reaches the server and there is
 * nothing here that could grow into a second, divergent filtering truth.
 *
 * GET, so a repeat window is answered by the CDN instead of a function. The
 * input is a list of public listing ids — nothing about the request describes
 * the driver making it, which is exactly the condition that makes a URL
 * acceptable. (Contrast /api/directory/nearby, whose input is the driver's
 * own coordinates and is therefore a POST body.)
 *
 * Eligibility is the database's answer, not the caller's claim: the read runs
 * through the cookieless anon client against `is_published` / `deleted_at`
 * with RLS as the authority, so asking for an unpublished id returns nothing
 * rather than a row. Ids missing from the response were not eligible; a
 * FAILED read is a 503, never an empty list, because "we could not look these
 * up" and "these do not exist" are different sentences.
 */
const cardsSchema = z.object({
  ids: z
    .string()
    .trim()
    .min(1, 'ids is required.')
    .transform((raw) =>
      raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(z.string().uuid('ids must be listing ids.'))
        .min(1, 'ids is required.')
        .max(CARD_LOOKUP_MAX_IDS, `At most ${CARD_LOOKUP_MAX_IDS} listings per request.`),
    ),
});

/**
 * Matches the pages' own `revalidate = 300`. A card cannot be fresher than
 * the index that named it, so a longer lifetime here would let the CDN answer
 * with a card the page no longer lists.
 */
const CACHE_CONTROL = 'public, max-age=0, s-maxage=300, stale-while-revalidate=60';

export const GET = guardedGet(
  cardsSchema,
  { routeKey: 'directory-cards', rateLimitMax: 60 },
  async ({ data }) => {
    const result = await getEntriesByIdsResult(data.ids);
    if (!result.ok) {
      return fail('Listing details are temporarily unavailable.', 503, 'unavailable');
    }
    const response = ok({ cards: result.data.map(toCardEntry) });
    response.headers.set('Cache-Control', CACHE_CONTROL);
    return response;
  },
);
