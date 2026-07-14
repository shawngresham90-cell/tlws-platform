import type { ProductReadiness, StoreCategorySlug, StoreProduct } from './types';
import { isValidAsin } from './amazon';

/**
 * Trucking Life Store catalog — 12 curated recommendation slots.
 *
 * EVERY entry is a PLACEHOLDER: `asin`, `priceUsd`, and `imageUrl` are null on
 * purpose. No ASIN, price, or Amazon image is guessed — the owner drops the
 * real values in and each product flips to sellable automatically (see
 * productReadiness). Until then the store shows the picks, the reasons, and a
 * clear "link coming soon" state — never a dead or fabricated Amazon button.
 *
 * The names below describe the KIND of product each slot is for; they are
 * category placeholders, not specific listings, so nothing here misrepresents
 * a real Amazon item.
 */
export const STORE_PRODUCTS: StoreProduct[] = [
  {
    slug: 'dual-dash-cam',
    name: 'Dual-Facing Dash Cam',
    category: 'electronics',
    tagline: 'Road-and-cab footage that backs up your side of the story.',
    description:
      'A front-and-inward dash cam is the cheapest insurance in the cab. When a four-wheeler cuts you off, the footage is the difference between an at-fault mark and a clean record.',
    benefits: ['Front + interior recording', 'Loop recording with incident lock', 'Protects your CDL record'],
    asin: null,
    priceUsd: null,
    imageUrl: null,
    icon: '📹',
    featured: true,
  },
  {
    slug: 'power-inverter',
    name: 'Heavy-Duty Power Inverter',
    category: 'electronics',
    tagline: 'Run the fridge, laptop, and CPAP without idling all night.',
    description:
      'A proper pure-sine inverter turns the truck into a home base — appliances, electronics, and medical gear run clean without frying anything sensitive.',
    benefits: ['Pure sine wave (safe for electronics)', 'Runs CPAP + fridge overnight', 'Hardwire or cig-socket options'],
    asin: null,
    priceUsd: null,
    imageUrl: null,
    icon: '🔋',
  },
  {
    slug: 'usb-fast-charger',
    name: '12V Multi-Port Fast Charger',
    category: 'electronics',
    tagline: 'Every device topped off by the next pre-trip.',
    description:
      'Phone, tablet, ELD, and headset all want power. A rugged multi-port 12V charger keeps the whole cab charged without a nest of adapters.',
    benefits: ['Multiple fast-charge ports', 'Fits the 12V socket', 'Built for constant road vibration'],
    asin: null,
    priceUsd: null,
    imageUrl: null,
    icon: '🔌',
  },
  {
    slug: 'memory-foam-topper',
    name: 'Truck Bunk Memory-Foam Topper',
    category: 'comfort-sleep',
    tagline: 'Turn the factory bunk into actual sleep.',
    description:
      'Reset starts with rest. A bunk-sized memory-foam topper is the single biggest upgrade most drivers make to how they feel at 3 a.m.',
    benefits: ['Sized for a truck bunk', 'Real pressure relief', 'Rolls up when you need the space'],
    asin: null,
    priceUsd: null,
    imageUrl: null,
    icon: '🛏️',
    featured: true,
  },
  {
    slug: 'blackout-window-covers',
    name: 'Magnetic Blackout Window Covers',
    category: 'comfort-sleep',
    tagline: 'Sleep at a lit truck stop like it’s midnight.',
    description:
      'Custom blackout covers snap over the cab glass so lot lights and daylight don’t wreck your off-duty sleep. Privacy and temperature control, too.',
    benefits: ['Full blackout for day sleep', 'Adds privacy + insulation', 'No adhesive residue'],
    asin: null,
    priceUsd: null,
    imageUrl: null,
    icon: '🌙',
  },
  {
    slug: '12v-portable-cooker',
    name: '12V Portable Cooker',
    category: 'cab-kitchen',
    tagline: 'A hot, real meal without leaving the truck.',
    description:
      'Plug-in cookers let you eat like a person on the road — cheaper than the truck-stop grill and better for staying right on a long run.',
    benefits: ['Runs off 12V', 'Home-cooked instead of fried', 'Easy one-pot cleanup'],
    asin: null,
    priceUsd: null,
    imageUrl: null,
    icon: '🍳',
  },
  {
    slug: '12v-cooler-fridge',
    name: '12V Cooler / Fridge',
    category: 'cab-kitchen',
    tagline: 'Cold groceries, no ice runs.',
    description:
      'A true 12V compressor fridge keeps meat, dairy, and water cold for days — the cornerstone of eating cheap and healthy over the road.',
    benefits: ['Compressor cooling (not just a cooler)', 'Days of cold storage', 'Cuts food + drink spend'],
    asin: null,
    priceUsd: null,
    imageUrl: null,
    icon: '🧊',
  },
  {
    slug: 'roadside-emergency-kit',
    name: 'Roadside Emergency Kit',
    category: 'safety-emergency',
    tagline: 'Triangles, flares, and first aid in one grab bag.',
    description:
      'DOT wants your warning devices; common sense wants the rest. One organized kit covers the breakdown you didn’t plan for.',
    benefits: ['Warning triangles + reflectors', 'First-aid essentials', 'Fits behind the seat'],
    asin: null,
    priceUsd: null,
    imageUrl: null,
    icon: '🦺',
    featured: true,
  },
  {
    slug: 'fire-extinguisher',
    name: 'Rated Cab Fire Extinguisher',
    category: 'safety-emergency',
    tagline: 'The inspection item that can also save the truck.',
    description:
      'A properly rated, mounted extinguisher is both a pre-trip checkbox and the thing that stops a small engine fire from ending your day.',
    benefits: ['Meets pre-trip requirements', 'Mount included', 'ABC-rated for the cab'],
    asin: null,
    priceUsd: null,
    imageUrl: null,
    icon: '🧯',
  },
  {
    slug: 'led-work-light',
    name: 'Rechargeable LED Work Light',
    category: 'tools-maintenance',
    tagline: 'See the problem at 2 a.m. on the shoulder.',
    description:
      'A bright, magnetic, rechargeable work light turns a dark trailer or engine bay into something you can actually work on.',
    benefits: ['Magnetic + hangable', 'USB rechargeable', 'Flood + spot modes'],
    asin: null,
    priceUsd: null,
    imageUrl: null,
    icon: '🔦',
  },
  {
    slug: 'tire-pressure-gauge',
    name: 'Heavy-Duty Tire Pressure Gauge',
    category: 'tools-maintenance',
    tagline: 'Catch the low tire before the blowout.',
    description:
      'A dual-head truck gauge reads the inside duals fast so your pre-trip is honest — the cheapest way to avoid a road-call and a violation.',
    benefits: ['Reads inner + outer duals', 'Truck-rated PSI range', 'Built to live in the door pocket'],
    asin: null,
    priceUsd: null,
    imageUrl: null,
    icon: '🛠️',
  },
  {
    slug: 'seat-back-support',
    name: 'Lumbar Seat-Back Support',
    category: 'health-wellness',
    tagline: 'Save your back over a million miles.',
    description:
      'The seat is your office. Real lumbar support is how veteran drivers keep their backs working into decade two of the job.',
    benefits: ['Targeted lumbar support', 'Straps to any truck seat', 'Breathable for long shifts'],
    asin: null,
    priceUsd: null,
    imageUrl: null,
    icon: '💪',
  },
];

if (STORE_PRODUCTS.length !== 12) {
  // Guardrail: the catalog is spec'd at exactly 12 slots.
  throw new Error(`Store catalog must have 12 products, found ${STORE_PRODUCTS.length}`);
}

const BY_SLUG = new Map(STORE_PRODUCTS.map((p) => [p.slug, p]));

export function storeProduct(slug: string): StoreProduct | undefined {
  return BY_SLUG.get(slug);
}

export function productsInCategory(category: StoreCategorySlug): StoreProduct[] {
  return STORE_PRODUCTS.filter((p) => p.category === category);
}

export function productHref(slug: string): string {
  return `/store/products/${slug}`;
}

/** Sellable = valid ASIN AND a confirmed price. Everything else is a placeholder. */
export function productReadiness(p: StoreProduct): ProductReadiness {
  const hasAsin = isValidAsin(p.asin);
  const hasPrice = typeof p.priceUsd === 'number' && p.priceUsd > 0;
  const hasImage = Boolean(p.imageUrl);
  const missing: string[] = [];
  if (!hasAsin) missing.push('ASIN');
  if (!hasPrice) missing.push('price');
  if (!hasImage) missing.push('image');
  return { hasAsin, hasPrice, hasImage, live: hasAsin && hasPrice, missing };
}

/** Whole-dollar price string, or null when unconfirmed (never guessed). */
export function priceLabel(p: StoreProduct): string | null {
  return typeof p.priceUsd === 'number' && p.priceUsd > 0
    ? `$${p.priceUsd.toLocaleString('en-US')}`
    : null;
}
