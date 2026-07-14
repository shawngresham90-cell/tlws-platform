import type { StoreCategorySlug } from './types';

/** Store categories — the ways a driver browses the gear picks. */
export type StoreCategory = {
  slug: StoreCategorySlug;
  title: string;
  icon: string;
  blurb: string;
};

export const STORE_CATEGORIES: StoreCategory[] = [
  {
    slug: 'electronics',
    title: 'Electronics & Cab Tech',
    icon: '🔌',
    blurb: 'Dash cams, inverters, chargers, and the tech that earns its spot on the dash.',
  },
  {
    slug: 'comfort-sleep',
    title: 'Comfort & Sleep',
    icon: '🛏️',
    blurb: 'Better rest in the bunk — mattresses, pillows, blackout, and climate.',
  },
  {
    slug: 'cab-kitchen',
    title: 'Cab Kitchen',
    icon: '🍳',
    blurb: 'Eat real on the road: 12V cookers, coolers, and mess-free setups.',
  },
  {
    slug: 'safety-emergency',
    title: 'Safety & Emergency',
    icon: '🦺',
    blurb: 'The gear you hope you never need — and are glad you had.',
  },
  {
    slug: 'tools-maintenance',
    title: 'Tools & Maintenance',
    icon: '🛠️',
    blurb: 'Keep the truck rolling and pass the inspection.',
  },
  {
    slug: 'health-wellness',
    title: 'Health & Wellness',
    icon: '💪',
    blurb: 'Stay right for the long haul — movement, hydration, and recovery.',
  },
  {
    slug: 'apparel-gear',
    title: 'Apparel & Everyday Gear',
    icon: '🧢',
    blurb: 'What holds up load after load — bags, boots, gloves, and layers.',
  },
];

const BY_SLUG = new Map(STORE_CATEGORIES.map((c) => [c.slug, c]));

export function storeCategory(slug: string): StoreCategory | undefined {
  return BY_SLUG.get(slug as StoreCategorySlug);
}

export function storeCategoryHref(slug: StoreCategorySlug): string {
  return `/store/category/${slug}`;
}
