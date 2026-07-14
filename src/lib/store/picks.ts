import type { StoreProduct } from './types';
import { storeProduct } from './products';

/**
 * "Shawn's Picks" — a hand-ordered shortlist of the gear Shawn steers drivers
 * to first, across categories. Each entry references a real catalog slug plus a
 * short, honest reason. No Amazon facts here — just the editorial pick order.
 */
export type ShawnPick = { slug: string; why: string };

export const SHAWNS_PICKS: ShawnPick[] = [
  { slug: 'dual-dash-cam', why: 'The cheapest insurance in the cab — get the front-and-interior one first.' },
  { slug: 'seat-back-support', why: 'Your back has to last a whole career. Fix the seat before it costs you.' },
  { slug: '12v-cooler-fridge', why: 'The single biggest step to eating cheap and healthy over the road.' },
  { slug: 'power-inverter', why: 'Clean power for the CPAP, laptop, and fridge without idling all night.' },
  { slug: 'truck-gps-navigator', why: 'Route by your real height and weight — not car directions into a low bridge.' },
  { slug: 'over-ear-trucker-headset', why: 'You live on the phone with dispatch. Comfort over a 14-hour day matters.' },
  { slug: 'roadside-emergency-kit', why: 'The breakdown you did not plan for is exactly when you want this behind the seat.' },
  { slug: 'led-work-light', why: 'Both hands free at 2 a.m. on the shoulder is worth every penny.' },
  { slug: 'memory-foam-topper', why: 'The easiest upgrade to how you actually feel at 3 a.m.' },
  { slug: 'full-size-cb-radio', why: 'Still the fastest heads-up on the scale, the wreck, and the backup ahead.' },
  { slug: '12v-portable-cooker', why: 'A hot, real meal in the cab beats the grill on price and on staying right.' },
  { slug: 'tire-pressure-gauge', why: 'Catch the low inner dual before it becomes a blowout and a violation.' },
];

/** Resolve picks to real products (skips any slug that is not in the catalog). */
export function shawnsPicks(): { product: StoreProduct; why: string }[] {
  return SHAWNS_PICKS.map((pick) => {
    const product = storeProduct(pick.slug);
    return product ? { product, why: pick.why } : null;
  }).filter((x): x is { product: StoreProduct; why: string } => x !== null);
}
