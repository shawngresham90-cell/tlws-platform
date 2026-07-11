import { z } from 'zod';
import { guardedPost } from '@/lib/api/handler';
import { getNearbyListings, NEARBY_MAX_RADIUS_MILES, NEARBY_MAX_LIMIT } from '@/lib/directory/nearby';
import { ok } from '@/lib/api/responses';

export const runtime = 'nodejs';

/**
 * Near-me lookups for the public map (Milestone 19). POST on purpose: the
 * user's coordinates travel in the body, never in a URL that could land in
 * request logs. Nothing here logs or stores the location — the handler passes
 * it straight to the read-only nearby_locations() RPC (RLS-scoped to
 * published rows, radius/limit hard-capped) and returns the result.
 */
const nearbySchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180),
  radiusMiles: z.number().finite().min(1).max(NEARBY_MAX_RADIUS_MILES).default(100),
  category: z.string().trim().max(40).optional(),
  limit: z.number().int().min(1).max(NEARBY_MAX_LIMIT).default(50),
});

export const POST = guardedPost(
  nearbySchema,
  { routeKey: 'directory-nearby', rateLimitMax: 30, requireTurnstile: false },
  async ({ data }) => {
    const listings = await getNearbyListings({
      lat: data.lat,
      lng: data.lng,
      radiusMiles: data.radiusMiles,
      category: data.category || undefined,
      limit: data.limit,
    });
    return ok({ listings });
  },
);
