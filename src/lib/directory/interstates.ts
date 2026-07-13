/**
 * Interstate registry for corridor landing pages (/directory/i75, …) and exit
 * pages (/directory/i75/exit-201). Any "I-<number>" designation stored on a
 * listing maps to a page automatically; the registry below only adds richer
 * copy and a geographic state order for corridors we've written up. Unknown
 * corridors still work — they just get generated copy and alphabetical states.
 */

export type DirectoryInterstate = {
  /** URL segment under /directory/, e.g. "i75". */
  slug: string;
  /** Highway designation as stored on listings, e.g. "I-75". */
  designation: string;
  /** One-liner for hero/meta copy. */
  intro: string;
  /** State codes in geographic order along the corridor (south→north or west→east). */
  stateOrder: string[];
};

/** Corridors with hand-written copy. Others fall back to generated copy. */
const KNOWN: DirectoryInterstate[] = [
  {
    slug: 'i75',
    designation: 'I-75',
    intro:
      'The eastern freight backbone — Miami to the Canadian border through Florida, Georgia, Tennessee, Kentucky, Ohio, and Michigan.',
    stateOrder: ['FL', 'GA', 'TN', 'KY', 'OH', 'MI'],
  },
  {
    slug: 'i65',
    designation: 'I-65',
    intro:
      'Gulf Coast to the Great Lakes — Mobile through Birmingham, Nashville, and Louisville toward Indianapolis on one of the busiest north–south freight lanes in the country.',
    stateOrder: ['AL', 'TN', 'KY', 'IN'],
  },
  {
    slug: 'i24',
    designation: 'I-24',
    intro:
      'The Chattanooga–Nashville–Paducah shortcut linking I-75 to the Midwest — heavy freight over Monteagle Mountain and through western Kentucky to southern Illinois.',
    stateOrder: ['IL', 'KY', 'TN', 'GA'],
  },
  {
    slug: 'i40',
    designation: 'I-40',
    intro:
      'The coast-to-coast southern freight artery — through Arkansas and Tennessee it links West Memphis, Little Rock, Nashville, and Knoxville on one continuous run.',
    stateOrder: ['AR', 'TN'],
  },
];

/** "I-75" → "i75"; returns null for values that aren't interstate designations. */
export function interstateSlug(designation: string): string | null {
  const m = designation.trim().match(/^I-?\s?(\d{1,3})$/i);
  return m ? `i${m[1]}` : null;
}

/** "i75" → the corridor record (registry copy when we have it, generated otherwise). */
export function interstateBySlug(slug: string): DirectoryInterstate | undefined {
  const m = slug.toLowerCase().match(/^i(\d{1,3})$/);
  if (!m) return undefined;
  const known = KNOWN.find((k) => k.slug === `i${m[1]}`);
  if (known) return known;
  return {
    slug: `i${m[1]}`,
    designation: `I-${m[1]}`,
    intro: `Truck stops, parking, scales, and services along the I-${m[1]} corridor.`,
    stateOrder: [],
  };
}

/** URL segment for an exit value, e.g. "201" → "exit-201", "7B" → "exit-7b". */
export function exitSlug(exitNumber: string): string {
  return `exit-${exitNumber.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`;
}

/**
 * Match an exit slug back to the stored exit_number value. The slug transform
 * is lossy, so we match against the corridor's known exit list instead of
 * inverting it.
 */
export function exitFromSlug(slug: string, knownExits: string[]): string | undefined {
  const normalized = slug.toLowerCase();
  return knownExits.find((e) => exitSlug(e) === normalized);
}
