/**
 * The Trucking Life ecosystem, as told in THE ROAD AHEAD's third chapter.
 * Each pillar is a real, shipped part of the platform with a real route — the
 * experience explains the whole thing, so a driver finishes knowing exactly
 * what Trucking Life is and where to go next. Copy stays trucker-direct and
 * makes no promises the platform doesn't keep (house rule: no invented urgency).
 *
 * Pure data — hrefs are validated against reality by review, and the list is
 * covered by scripts/test-road-ahead.ts (unique ids, non-empty fields).
 */

export type EcosystemPillar = {
  id: string;
  name: string;
  href: string;
  /** One-line identity. */
  tagline: string;
  /** Two-sentence explanation of what it is and who it's for. */
  blurb: string;
};

export const ECOSYSTEM_PILLARS: EcosystemPillar[] = [
  {
    id: 'academy',
    name: 'The Academy',
    href: '/academy',
    tagline: 'Get your CDL on real trucks',
    blurb:
      'ELDT-compliant CDL-A training in Dalton, GA — real equipment, real instructors. Where a career behind the wheel actually starts.',
  },
  {
    id: 'pre-school',
    name: 'CDL Pre-School',
    href: '/cdl-pre-school',
    tagline: 'Know what you’re walking into',
    blurb:
      'The prep drivers wish they’d had before day one: the knowledge, the expectations, the real-life readiness. Show up to CDL school already ahead.',
  },
  {
    id: 'knowledge',
    name: 'Knowledge Center',
    href: '/knowledge',
    tagline: 'Straight answers, free forever',
    blurb:
      'Guides and plain-language answers to the questions new and working drivers actually ask. No paywall, no runaround.',
  },
  {
    id: 'practice-tests',
    name: 'Practice Tests',
    href: '/practice-tests',
    tagline: 'Pass the permit exam',
    blurb:
      'Practice the CDL general, air brakes, combination and endorsement tests until you’re sure. Track what you miss and drill it.',
  },
  {
    id: 'trip-planner',
    name: 'Trip Planner & Directory',
    href: '/directory/trip-planner',
    tagline: 'Plan the drive, find the stop',
    blurb:
      'Truck-legal route planning with hours-of-service awareness, plus a directory of parking and stops built for big rigs. The road, mapped for the way you actually run it.',
  },
  {
    id: 'store',
    name: 'Store, Books & Apps',
    href: '/store',
    tagline: 'Gear that backs the mission',
    blurb:
      'Apparel, books and tools from the Trucking Life world. Every order helps fund the school and the drivers coming up behind you.',
  },
];

/** Validate the ecosystem list. Returns human-readable problems (empty = ok). */
export function validateEcosystem(): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const p of ECOSYSTEM_PILLARS) {
    if (ids.has(p.id)) problems.push(`duplicate ecosystem id "${p.id}"`);
    ids.add(p.id);
    if (!p.name.trim()) problems.push(`ecosystem "${p.id}" missing name`);
    if (!p.href.startsWith('/')) problems.push(`ecosystem "${p.id}" href is not an internal route`);
    if (!p.tagline.trim()) problems.push(`ecosystem "${p.id}" missing tagline`);
    if (!p.blurb.trim()) problems.push(`ecosystem "${p.id}" missing blurb`);
  }
  return problems;
}
