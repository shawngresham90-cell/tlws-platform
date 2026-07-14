import type { StoreProduct, StoreProductType } from './types';
import { STORE_PRODUCTS, productsOfType, productsInCategory } from './products';

/**
 * Related products: same product type first (the natural "compare these"
 * neighbours), then filled out with same-category items. Pure and deterministic
 * so it renders the same on every build.
 */
export function relatedProducts(product: StoreProduct, limit = 4): StoreProduct[] {
  const seen = new Set<string>([product.slug]);
  const out: StoreProduct[] = [];
  const push = (list: StoreProduct[]) => {
    for (const p of list) {
      if (out.length >= limit) break;
      if (seen.has(p.slug)) continue;
      seen.add(p.slug);
      out.push(p);
    }
  };
  push(productsOfType(product.productType));
  if (out.length < limit) push(productsInCategory(product.category));
  return out;
}

/**
 * "Frequently Bought Together" — Shawn's suggested pairings, NOT Amazon purchase
 * data. We map each product type to the complementary types a driver tends to
 * buy alongside it, then surface one honest pick from each. Nothing here claims
 * a real "customers also bought" statistic.
 */
const COMPLEMENTS: Record<StoreProductType, StoreProductType[]> = {
  'dash-cam': ['charger', 'gps'],
  gps: ['charger', 'dash-cam'],
  'cb-radio': ['charger', 'organization'],
  'bluetooth-headset': ['charger', 'organization'],
  'power-inverter': ['fridge', 'cpap'],
  charger: ['organization', 'power-inverter'],
  organization: ['charger', 'cleaning'],
  fridge: ['power-inverter', 'cab-cooking'],
  'electric-skillet': ['power-inverter', 'cab-cooking'],
  'cab-cooking': ['fridge', 'electric-skillet'],
  'seat-cushion': ['bedding', 'health'],
  bedding: ['seat-cushion', 'health'],
  'dot-gear': ['flashlight', 'tools'],
  flashlight: ['tools', 'dot-gear'],
  tools: ['flashlight', 'dot-gear'],
  cleaning: ['organization', 'tools'],
  cpap: ['power-inverter', 'health'],
  health: ['seat-cushion', 'health'],
  apparel: ['tools', 'apparel'],
};

export function frequentlyBoughtTogether(product: StoreProduct, limit = 3): StoreProduct[] {
  const seen = new Set<string>([product.slug]);
  const out: StoreProduct[] = [];
  const pickFrom = (type: StoreProductType) => {
    // Prefer a featured item of the type, else the first that isn't the product itself.
    const pool = productsOfType(type);
    const choice = pool.find((p) => p.featured && !seen.has(p.slug)) ?? pool.find((p) => !seen.has(p.slug));
    if (choice) {
      seen.add(choice.slug);
      out.push(choice);
    }
  };
  for (const type of COMPLEMENTS[product.productType] ?? []) {
    if (out.length >= limit) break;
    pickFrom(type);
  }
  // Backfill from same category if we came up short.
  if (out.length < limit) {
    for (const p of STORE_PRODUCTS) {
      if (out.length >= limit) break;
      if (p.category === product.category && !seen.has(p.slug)) {
        seen.add(p.slug);
        out.push(p);
      }
    }
  }
  return out.slice(0, limit);
}
