/**
 * Unit tests for the internal-link graph (`lib/directory/related` +
 * `lib/directory/scope-links`) — the pure logic behind "Nearby X",
 * adjacent-exit hops, and every "Keep exploring" cross-link block that ties
 * state ⇄ interstate ⇄ exit ⇄ category ⇄ community pages together.
 *
 * Run:
 *   npx esbuild scripts/test-linking.ts --bundle --platform=node --format=cjs \
 *     --alias:@=./src --outfile=/tmp/test-linking.cjs && node /tmp/test-linking.cjs
 */
import {
  groupByCategory,
  entriesNearExit,
  adjacentExits,
  interstatesIn,
} from '@/lib/directory/related';
import {
  stateScopeLinks,
  interstateScopeLinks,
  exitScopeLinks,
  categoryScopeLinks,
} from '@/lib/directory/scope-links';
import type { DirectoryEntry } from '@/lib/directory/types';
import type { DirectoryFacets } from '@/lib/directory/data';

let passed = 0;
let failed = 0;
const check = (name: string, cond: boolean, detail?: unknown) => {
  if (cond) passed++;
  else {
    failed++;
    console.log('FAIL:', name, detail ?? '');
  }
};

let n = 0;
function entry(over: Partial<DirectoryEntry> = {}): DirectoryEntry {
  n += 1;
  return {
    id: `id-${n}`,
    category: 'truck-stops',
    name: `Stop ${n}`,
    state: 'TN',
    city: 'Nashville',
    slug: `stop-${n}`,
    ...over,
  };
}

const FACETS: DirectoryFacets = {
  states: ['GA', 'TN'],
  interstates: ['I-24', 'I-75'],
  exitsByInterstate: { 'I-75': ['2', '11', '20', '81', '110'] },
  countsByState: { GA: 78, TN: 89 },
  countsByInterstate: { 'I-24': 43, 'I-75': 300 },
};

const allLinks = (groups: { links: { href: string; label: string }[] }[]) =>
  groups.flatMap((g) => g.links);

/* ---------------------- related.ts ---------------------- */
{
  const es = [
    entry({ category: 'truck-stops' }),
    entry({ category: 'truck-stops' }),
    entry({ category: 'cat-scales' }),
  ];
  const groups = groupByCategory(es);
  check('groupByCategory splits by slug', groups['truck-stops'].length === 2 && groups['cat-scales'].length === 1);

  const corridor = [
    entry({ name: 'AtTarget', exitNumber: '81', state: 'TN' }),
    entry({ name: 'Near', exitNumber: '84', state: 'TN' }),
    entry({ name: 'Nearer', exitNumber: '82', state: 'TN' }),
    entry({ name: 'TooFar', exitNumber: '120', state: 'TN' }),
    entry({ name: 'WrongState', exitNumber: '82', state: 'GA' }),
    entry({ name: 'NoExit', state: 'TN' }),
  ];
  const near = entriesNearExit(corridor, '81', ['TN']);
  check('excludes the exit itself', !near.some((e) => e.name === 'AtTarget'));
  check('window excludes far exits', !near.some((e) => e.name === 'TooFar'));
  check('state filter applies', !near.some((e) => e.name === 'WrongState'));
  check('exitless entries dropped', !near.some((e) => e.name === 'NoExit'));
  check('sorted by exit distance', near.map((e) => e.name).join() === 'Nearer,Near', near.map((e) => e.name));
  check('non-numeric target exit → []', entriesNearExit(corridor, 'ramp', ['TN']).length === 0);

  const adj = adjacentExits(['2', '11', '20', '81', '110'], '20');
  check('adjacent previous (numeric order)', adj.previous.join() === '2,11');
  check('adjacent next', adj.next.join() === '81,110');
  const edge = adjacentExits(['2', '11', '20'], '2');
  check('first exit has no previous', edge.previous.length === 0 && edge.next.join() === '11,20');
  check('unknown exit → empty both ways', adjacentExits(['2', '11'], '99').previous.length === 0 && adjacentExits(['2', '11'], '99').next.length === 0);

  const mixed = [entry({ interstate: 'I-75' }), entry({ interstate: 'I-24' }), entry({ interstate: 'I-75' }), entry({})];
  check('interstatesIn distinct + sorted', interstatesIn(mixed).join() === 'I-24,I-75');
}

/* ---------------------- scope-links.ts ---------------------- */
{
  const tnEntries = [
    entry({ state: 'TN', interstate: 'I-24', category: 'truck-stops' }),
    entry({ state: 'TN', interstate: 'I-75', category: 'cat-scales' }),
  ];
  const groups = stateScopeLinks('Tennessee', 'TN', tnEntries, FACETS);
  const links = allLinks(groups);
  check('state scope links corridors through the state', links.some((l) => l.href === '/directory/i24') && links.some((l) => l.href === '/directory/i75'));
  check('state scope links in-state categories with counts', links.some((l) => l.href.includes('truck-stops') && l.label.includes('1 in Tennessee')));
  check('state scope excludes own state from others', !links.some((l) => l.href === '/directory/tennessee'));
  check('state scope links other covered states with counts', links.some((l) => l.href === '/directory/georgia' && l.label === 'Georgia (78)'));
  check('community links present', links.some((l) => l.href === '/directory/submit'));

  const corridorEntries = [
    entry({ state: 'GA', interstate: 'I-75' }),
    entry({ state: 'TN', interstate: 'I-75' }),
  ];
  const igroups = interstateScopeLinks('I-75', ['FL', 'GA', 'TN', 'KY'], corridorEntries, FACETS);
  const stateByState = igroups[0];
  check('corridor states follow stateOrder and only covered states', stateByState.links.map((l) => l.href).join() === '/directory/georgia,/directory/tennessee', stateByState.links);
  const ilinks = allLinks(igroups);
  check('corridor excludes itself from other corridors', !ilinks.some((l) => l.href === '/directory/i75' && l.label.includes('corridor')));
  check('corridor links sibling corridor with count', ilinks.some((l) => l.label === 'I-24 corridor (43)'));

  const egroups = exitScopeLinks('I-75', 'i75', '20', FACETS.exitsByInterstate['I-75'], ['TN'], FACETS);
  const elinks = allLinks(egroups);
  check('exit page links neighboring exits both ways', elinks.some((l) => l.label === '← Exit 11') && elinks.some((l) => l.label === 'Exit 81 →'));
  check('exit neighbor hrefs use exit slugs', elinks.some((l) => l.href === '/directory/i75/exit-11'));
  check('exit page zooms out to corridor + state', elinks.some((l) => l.href === '/directory/i75') && elinks.some((l) => l.href === '/directory/tennessee'));

  const cgroups = categoryScopeLinks(FACETS);
  const clinks = allLinks(cgroups);
  check('category scope lists every covered state', clinks.some((l) => l.href === '/directory/georgia') && clinks.some((l) => l.href === '/directory/tennessee'));
  check('category scope lists every corridor with counts', clinks.some((l) => l.label === 'I-75 corridor (300)'));
}

/* ---------------------- graph invariants ---------------------- */
{
  // Every emitted href is a rooted internal path — no external or relative links.
  const everything = [
    ...allLinks(stateScopeLinks('Tennessee', 'TN', [entry({ interstate: 'I-24' })], FACETS)),
    ...allLinks(interstateScopeLinks('I-75', ['GA', 'TN'], [entry({ interstate: 'I-75' })], FACETS)),
    ...allLinks(exitScopeLinks('I-75', 'i75', '20', FACETS.exitsByInterstate['I-75'], ['TN'], FACETS)),
    ...allLinks(categoryScopeLinks(FACETS)),
  ];
  check('all hrefs internal + rooted', everything.every((l) => l.href.startsWith('/')), everything.filter((l) => !l.href.startsWith('/')));
  check('no empty labels', everything.every((l) => l.label.trim().length > 0));
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
