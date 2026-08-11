import { PRESCHOOL_PATH } from '@/lib/preschool/constants';

/**
 * Slot map for the persistent mobile bottom bar — pure data plus a pure
 * resolver, kept out of the client component so the mapping is unit-testable
 * without a router (scripts/test-mobile-toolbar.ts).
 *
 * Doctrine (master blueprint Part 4 — conversion):
 *  - Parking and Trip Planner are PERMANENT, Parking first. The bar is one
 *    of the site's pinned parking entrances (test-home-promos).
 *  - The THIRD slot is contextual: on a page family with one clear next
 *    action, the generic HOS calculator yields to that action — Academy
 *    pages offer Apply, the Knowledge Base offers CDL Pre-School.
 *    Everywhere else (including /cdl-pre-school itself, where the sticky
 *    purchase bar IS the money surface) the default HOS slot stays.
 *  - A money slot changes the TEXT color only — amber, exactly the weight
 *    of the bar's existing active state. It never becomes a filled amber
 *    bar: the page's primary CTA keeps the one-amber-element-per-viewport
 *    doctrine.
 */

export type ToolbarToolIcon = 'parking' | 'trip' | 'hos' | 'apply' | 'preschool';

export type ToolbarTool = {
  href: string;
  label: string;
  icon: ToolbarToolIcon;
  /** Money/action slot — amber text treatment, never a fill. */
  money?: boolean;
};

const PARKING: ToolbarTool = { href: '/directory/parking', label: 'Parking', icon: 'parking' };
const TRIP: ToolbarTool = { href: '/trip-planner', label: 'Trip Planner', icon: 'trip' };
const HOS: ToolbarTool = { href: '/tools/hos-calculator', label: 'HOS', icon: 'hos' };

const APPLY: ToolbarTool = { href: '/academy/apply', label: 'Apply', icon: 'apply', money: true };
const PRESCHOOL: ToolbarTool = {
  href: PRESCHOOL_PATH,
  label: 'Pre-School',
  icon: 'preschool',
  money: true,
};

/** Segment-exact family test — '/academyx' is not '/academy'. */
const inFamily = (pathname: string, root: string): boolean =>
  pathname === root || pathname.startsWith(`${root}/`);

export function toolsFor(pathname: string): readonly [ToolbarTool, ToolbarTool, ToolbarTool] {
  if (inFamily(pathname, '/academy')) return [PARKING, TRIP, APPLY];
  if (inFamily(pathname, '/knowledge')) return [PARKING, TRIP, PRESCHOOL];
  return [PARKING, TRIP, HOS];
}
