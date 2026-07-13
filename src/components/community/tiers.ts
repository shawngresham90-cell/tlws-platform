import type { FounderTier } from '@/lib/community/founders';

/**
 * Founder tiers — one source of truth for labels, ordering, and the plain-language
 * promise of each level. Order is wall/recognition order (top of the wall first).
 * Dollar thresholds are intentionally NOT hard-coded here: amounts aren't final,
 * so the page marks them with <Placeholder> rather than shipping a made-up number.
 *
 * `capacity` is the number of spots a tier offers, used to derive "open spots"
 * (capacity − founder spots filled in that tier). `null` = uncapped.
 * Iron/Steel/Brick capacities (10 / 25 / 50) are confirmed by the site owner.
 * The two sponsor tiers have no published cap. Open spots count SPOTS SOLD
 * (records), so a founder holding two spots fills two.
 * See docs/founders-wall-source-audit.md.
 */
export type TierMeta = {
  value: FounderTier;
  label: string;
  blurb: string;
  capacity: number | null;
};

export const FOUNDER_TIERS: TierMeta[] = [
  {
    value: 'equipment_sponsor',
    label: 'Equipment Sponsor',
    blurb: 'Fund a real piece of training equipment that every future class will learn on.',
    capacity: null,
  },
  {
    value: 'student_sponsor',
    label: 'Student Sponsor',
    blurb: 'Put a driver in the seat — back a student’s path to a CDL and a career.',
    capacity: null,
  },
  {
    value: 'iron',
    label: 'Iron Founder',
    blurb: 'A cornerstone contribution toward getting the school built and rolling.',
    capacity: 10,
  },
  {
    value: 'steel',
    label: 'Steel Founder',
    blurb: 'A major boost to the build — your name high on the wall.',
    capacity: 25,
  },
  {
    value: 'brick',
    label: 'Brick Founder',
    blurb: 'Lay a brick in the foundation. Every founder counts, no matter the size.',
    capacity: 50,
  },
];

/** Tier capacity by value (null = uncapped/unknown). */
export const TIER_CAPACITY: Record<FounderTier, number | null> = FOUNDER_TIERS.reduce(
  (acc, t) => {
    acc[t.value] = t.capacity;
    return acc;
  },
  {} as Record<FounderTier, number | null>,
);

export const TIER_LABEL: Record<FounderTier, string> = FOUNDER_TIERS.reduce(
  (acc, t) => {
    acc[t.value] = t.label;
    return acc;
  },
  {} as Record<FounderTier, string>,
);

/** Wall grouping order (index in FOUNDER_TIERS). Lower = higher on the wall. */
export const TIER_ORDER: FounderTier[] = FOUNDER_TIERS.map((t) => t.value);
