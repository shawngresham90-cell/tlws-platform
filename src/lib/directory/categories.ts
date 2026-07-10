import type { DirectoryCategory } from './types';

/**
 * The directory category registry — one source of truth for the hub cards,
 * the engine's static params, per-category SEO, and hero copy. Adding a new
 * directory = adding an entry here (plus data when the DB lands).
 */
export const DIRECTORY_CATEGORIES: DirectoryCategory[] = [
  {
    slug: 'parking',
    title: 'Truck Parking',
    icon: '🅿️',
    shortDescription:
      'Free, paid, and reserved parking — truck stops, rest areas, and safe spots to shut down for the night.',
    seoTitle: 'Truck Parking Directory — Free, Paid & Reserved Parking | Trucking Life with Shawn',
    seoDescription:
      'Find truck parking: free spots, paid and reserved parking, truck stops, rest areas, safe locations, and driver-submitted spots.',
    heroTitle: 'Stop circling for a spot',
    heroIntro:
      'Free parking when you can get it, paid or reserved when a guaranteed spot beats an hour of hunting.',
    dbType: 'parking',
    // Truck Parking keeps its hand-built foundation page (Milestone: hotfix #7).
    customHref: '/directory/parking',
  },
  {
    slug: 'truck-stops',
    title: 'Truck Stops',
    icon: '⛽',
    shortDescription:
      'Fuel, food, showers, and amenities — what’s actually at the exit before you take it.',
    seoTitle: 'Truck Stop Directory — Fuel, Showers & Parking by State | Trucking Life with Shawn',
    seoDescription:
      'Find truck stops by state and city: fuel brands, showers, food, parking counts, and the amenities that matter — built by a 17-year driver.',
    heroTitle: 'Know the exit before you take it',
    heroIntro:
      'Fuel, food, showers, parking counts — the truck stops on your lane and what’s actually inside them.',
    dbType: 'truck_stop',
  },
  {
    slug: 'cat-scales',
    title: 'CAT Scales',
    icon: '📏',
    shortDescription: 'Certified scales to check your axles before the DOT checks them for you.',
    seoTitle: 'CAT Scale Directory — Certified Truck Scales by State | Trucking Life with Shawn',
    seoDescription:
      'Find certified CAT scales by state and city. Weigh your axles before the DOT does — locations, hours, and nearby truck stops.',
    heroTitle: 'Scale it before they weigh it',
    heroIntro:
      'Certified scales on your route, so you catch a heavy axle in the fuel line — not at the coop.',
    dbType: 'other',
  },
  {
    slug: 'truck-washes',
    title: 'Truck Washes',
    icon: '🚿',
    shortDescription: 'Where to get the tractor and trailer cleaned up without burning half a day.',
    seoTitle: 'Truck Wash Directory — Tractor & Trailer Washes by State | Trucking Life with Shawn',
    seoDescription:
      'Find truck washes by state and city: tractor washouts, trailer washes, and full detail — without burning half a day in line.',
    heroTitle: 'Shine it up without losing the day',
    heroIntro: 'Washouts, exterior washes, and detail shops — and which ones move the line.',
    dbType: 'other',
  },
  {
    slug: 'tire-repair',
    title: 'Tire Repair',
    icon: '🛞',
    shortDescription:
      'Tire shops and road service — because blowouts don’t wait for business hours.',
    seoTitle: 'Truck Tire Repair Directory — Shops & Road Service | Trucking Life with Shawn',
    seoDescription:
      'Find truck tire repair by state and city: tire shops, 24/7 road service, and mobile units — because blowouts don’t wait for business hours.',
    heroTitle: 'Blowouts don’t make appointments',
    heroIntro: 'Tire shops and 24/7 road service on your lane — before you’re on the shoulder.',
    dbType: 'repair',
  },
  {
    slug: 'weigh-stations',
    title: 'Weigh Stations',
    icon: '⚖️',
    shortDescription: 'Know the coops on your route before you roll up on one.',
    seoTitle: 'Weigh Station Directory — Coops by State & Highway | Trucking Life with Shawn',
    seoDescription:
      'Find weigh stations by state: locations, bypass programs, and what to expect — know the coops on your route before you roll up on one.',
    heroTitle: 'No surprises at the coop',
    heroIntro: 'Every weigh station on your route, before it’s a set of flashing lights ahead.',
    dbType: 'weigh_station',
  },
  {
    slug: 'hotels-truck-parking',
    title: 'Hotels with Truck Parking',
    icon: '🏨',
    shortDescription:
      'A real bed and a legal spot for the truck — hotels that actually fit a 70-foot rig.',
    seoTitle:
      'Hotels with Truck Parking — Driver-Friendly Stays by State | Trucking Life with Shawn',
    seoDescription:
      'Find hotels with real truck parking by state and city — big-rig-friendly lots, driver rates, and a real bed without abandoning the truck.',
    heroTitle: 'A real bed, a legal spot',
    heroIntro:
      'Hotels whose lots actually fit a 70-foot rig — so a night in a bed doesn’t cost you the truck.',
    dbType: 'other',
  },
  {
    slug: 'cdl-schools',
    title: 'CDL Schools',
    icon: '🎓',
    shortDescription: 'ELDT-compliant training programs — find a school that puts drivers first.',
    seoTitle: 'CDL School Directory — Truck Driving Schools by State | Trucking Life with Shawn',
    seoDescription:
      'Find CDL schools by state and city: ELDT-compliant programs, real equipment, and driver-first training — vetted by a 17-year driver.',
    heroTitle: 'Training that puts drivers first',
    heroIntro:
      'CDL programs worth your money — starting with the schools that train like the job actually is.',
    dbType: 'cdl_school',
  },
  {
    slug: 'roadside-service',
    title: 'Roadside Service',
    icon: '🔧',
    shortDescription: 'Mobile mechanics and 24/7 breakdown help for when the truck quits on you.',
    seoTitle: 'Truck Roadside Service Directory — 24/7 Breakdown Help | Trucking Life with Shawn',
    seoDescription:
      'Find truck roadside service by state and city: mobile mechanics, 24/7 breakdown assistance, towing, and jump starts — help when the truck quits.',
    heroTitle: 'Help when the truck quits',
    heroIntro:
      'Mobile mechanics, towing, and 24/7 breakdown service — sorted by where you’re broke down.',
    dbType: 'repair',
  },
];

/** Categories served by the shared engine page (everything without a custom page). */
export const ENGINE_CATEGORIES = DIRECTORY_CATEGORIES.filter((c) => !c.customHref);

export function getCategory(slug: string): DirectoryCategory | undefined {
  return DIRECTORY_CATEGORIES.find((c) => c.slug === slug);
}

/** The href a category card should link to. */
export function categoryHref(category: DirectoryCategory): string {
  return category.customHref ?? `/directory/${category.slug}`;
}
