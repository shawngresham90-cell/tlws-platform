/**
 * US state registry for the directory's state landing pages
 * (/directory/georgia, /directory/tennessee, …). All 50 states + DC are
 * registered so a state page exists the moment its first listing is imported —
 * no code change per state. Which states actually get pages is decided by the
 * data (see getDirectoryFacets in data.ts), not by this list.
 */

export type DirectoryState = {
  /** Two-letter USPS code, e.g. "GA" — matches locations.state. */
  code: string;
  /** Full display name, e.g. "Georgia". */
  name: string;
  /** URL segment under /directory/, e.g. "georgia". */
  slug: string;
};

const NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi',
  MO: 'Missouri', MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire',
  NJ: 'New Jersey', NM: 'New Mexico', NY: 'New York', NC: 'North Carolina',
  ND: 'North Dakota', OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming', DC: 'District of Columbia',
};

export const DIRECTORY_STATES: DirectoryState[] = Object.entries(NAMES).map(([code, name]) => ({
  code,
  name,
  slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
}));

const BY_SLUG = new Map(DIRECTORY_STATES.map((s) => [s.slug, s]));
const BY_CODE = new Map(DIRECTORY_STATES.map((s) => [s.code, s]));

export function stateBySlug(slug: string): DirectoryState | undefined {
  return BY_SLUG.get(slug.toLowerCase());
}

export function stateByCode(code: string): DirectoryState | undefined {
  return BY_CODE.get(code.trim().toUpperCase());
}
