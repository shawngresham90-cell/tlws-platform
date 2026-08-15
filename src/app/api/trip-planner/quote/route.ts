import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { composeQuote, quoteRequestSchema } from '@/lib/trip-planner/compose-quote';
import { loadPlannerListings } from '@/lib/trip-planner/directory-loader';
import { createNwsWeatherPort } from '@/lib/trip-planner/nws-weather';
import { eiaDieselPrice } from '@/lib/trip-planner/eia-fuel';
import { createHereRoutingPort } from '@/lib/trip-planner/here-routing';
import { guardedParse } from '@/lib/trip-planner/api-util';

// Module-level so the route cache and free-tier call counter survive across
// requests within a warm serverless instance.
const hereRouting = createHereRoutingPort(
  async (url: string) => {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    return { status: res.status, json: () => res.json() };
  },
  process.env.HERE_API_KEY,
  {
    /*
     * THE CLOCK-LIMIT PIN NEEDS THE ROAD IT SITS ON.
     *
     * "Here is where your clock runs out" is one of the Trip Planner's
     * central promises, and placing that marker needs the decoded
     * polyline — action timings alone can say WHEN the truck reaches a
     * point but not WHERE it is. Without geometry the results map can
     * only say the location cannot be mapped safely, which is honest but
     * is not the product.
     *
     * The cache is bounded to match: full geometry is far larger than the
     * sampled route points, so this instance keeps fewer routes than the
     * default rather than holding hundreds of polylines in a warm
     * function. Same discipline as the Navigator's own instance.
     */
    retainGeometry: true,
    cacheMax: 24,
  },
);

/**
 * POST /api/trip-planner/quote — the mobile UI's composite endpoint:
 * estimated route + directory candidates + HOS plan + NWS weather + EIA
 * fuel price, every provider fail-soft. Secrets (EIA_API_KEY) stay
 * server-side; responses contain processed data only.
 */
export async function POST(req: NextRequest) {
  const guarded = await guardedParse(req, quoteRequestSchema);
  if ('response' in guarded) return guarded.response;

  // Short per-request timeouts: providers are fail-soft, and composeQuote
  // holds an overall budget per provider — a slow upstream must never eat
  // the serverless function's own time limit.
  const nwsFetch = async (url: string, headers: Record<string, string>) => {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(3500) });
    return { status: res.status, json: () => res.json() };
  };
  const eiaFetch = async (url: string) => {
    const res = await fetch(url, { signal: AbortSignal.timeout(3500) });
    return { status: res.status, json: () => res.json() };
  };

  const result = await composeQuote(guarded.data, {
    loadListings: loadPlannerListings,
    weather: createNwsWeatherPort(nwsFetch),
    fuelPrice: (state) => eiaDieselPrice(state, eiaFetch, process.env.EIA_API_KEY),
    routing: hereRouting,
  });
  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
