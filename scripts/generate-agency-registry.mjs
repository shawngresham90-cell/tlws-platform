/**
 * Builds the ranked official agency acquisition registry for gate lines 5 and 6
 * (public rest areas / welcome centers / service plazas, and weigh stations).
 *
 * Ranking is COMPUTED, not asserted: a state's priority follows from how many
 * priority freight corridors it carries and how much published parking the
 * directory has on them today. That way the order cannot drift out of sync
 * with the measured baseline.
 *
 * NO URL BELOW WAS FETCHED OR VERIFIED. Every agency host is blocked at this
 * environment's egress proxy. Entry points are recorded as the canonical place
 * to start and must be confirmed on arrival — agencies reorganise their open
 * data portals often. Nothing here is a claim that a given dataset exists at a
 * given path today.
 *
 * Emits:
 *   data/imports/nationwide-parking-2026-07-26/agency-registry.json
 *   data/imports/nationwide-parking-2026-07-26/AGENCY-REGISTRY.md
 *
 * Run: node scripts/generate-agency-registry.mjs
 */
import { writeFileSync } from 'node:fs';

const DIR = 'data/imports/nationwide-parking-2026-07-26';

/* The five corridors the launch gate names as priorities, and the states each
 * one runs through. I-90 and I-94 are counted as one priority per the gate. */
const CORRIDORS = {
  'I-95': [
    'ME',
    'NH',
    'MA',
    'RI',
    'CT',
    'NY',
    'NJ',
    'PA',
    'DE',
    'MD',
    'DC',
    'VA',
    'NC',
    'SC',
    'GA',
    'FL',
  ],
  'I-80': ['NJ', 'PA', 'OH', 'IN', 'IL', 'IA', 'NE', 'WY', 'UT', 'NV', 'CA'],
  'I-90/I-94': ['MA', 'NY', 'PA', 'OH', 'IN', 'IL', 'MI', 'WI', 'MN', 'ND', 'SD', 'MT', 'ID', 'WA'],
  'I-10': ['FL', 'AL', 'MS', 'LA', 'TX', 'NM', 'AZ', 'CA'],
  'I-15': ['CA', 'NV', 'AZ', 'UT', 'ID', 'MT'],
};

/* State transport agency names. These are stable institutional names, not
 * URLs — the acronym is what a request has to be addressed to. */
const AGENCY = {
  AL: 'Alabama DOT (ALDOT)',
  AZ: 'Arizona DOT (ADOT)',
  CA: 'California DOT (Caltrans)',
  CT: 'Connecticut DOT (CTDOT)',
  DC: 'District DOT (DDOT)',
  DE: 'Delaware DOT (DelDOT)',
  FL: 'Florida DOT (FDOT)',
  GA: 'Georgia DOT (GDOT)',
  IA: 'Iowa DOT',
  ID: 'Idaho Transportation Department (ITD)',
  IL: 'Illinois DOT (IDOT)',
  IN: 'Indiana DOT (INDOT)',
  LA: 'Louisiana DOTD',
  MA: 'Massachusetts DOT (MassDOT)',
  MD: 'Maryland DOT State Highway Administration (MDOT SHA)',
  ME: 'Maine DOT (MaineDOT)',
  MI: 'Michigan DOT (MDOT)',
  MN: 'Minnesota DOT (MnDOT)',
  MS: 'Mississippi DOT (MDOT)',
  MT: 'Montana DOT (MDT)',
  NC: 'North Carolina DOT (NCDOT)',
  ND: 'North Dakota DOT (NDDOT)',
  NE: 'Nebraska DOT (NDOT)',
  NH: 'New Hampshire DOT (NHDOT)',
  NJ: 'New Jersey DOT (NJDOT)',
  NM: 'New Mexico DOT (NMDOT)',
  NV: 'Nevada DOT (NDOT)',
  NY: 'New York State DOT (NYSDOT)',
  OH: 'Ohio DOT (ODOT)',
  PA: 'Pennsylvania DOT (PennDOT)',
  RI: 'Rhode Island DOT (RIDOT)',
  SC: 'South Carolina DOT (SCDOT)',
  SD: 'South Dakota DOT (SDDOT)',
  TX: 'Texas DOT (TxDOT)',
  UT: 'Utah DOT (UDOT)',
  VA: 'Virginia DOT (VDOT)',
  WA: 'Washington State DOT (WSDOT)',
  WI: 'Wisconsin DOT (WisDOT)',
  WY: 'Wyoming DOT (WYDOT)',
};

/* Toll authorities that own the service plazas on their own roads. A state DOT
 * rest-area dataset will NOT contain these, and missing them leaves holes on
 * exactly the corridors that matter most. */
const TOLL_AUTHORITY = {
  NJ: ['New Jersey Turnpike Authority (I-95 / NJ Turnpike service areas)'],
  NY: ['New York State Thruway Authority (I-87 / I-90 service areas)'],
  PA: ['Pennsylvania Turnpike Commission (I-76 / I-276 service plazas)'],
  MA: ['MassDOT — I-90 Mass Pike service plazas'],
  OH: ['Ohio Turnpike and Infrastructure Commission (I-80 / I-90 service plazas)'],
  IN: ['Indiana Toll Road Concession Company (I-80 / I-90 service plazas)'],
  IL: ['Illinois State Toll Highway Authority (I-90 / I-294 oases)'],
  ME: ['Maine Turnpike Authority (I-95 service plazas)'],
  DE: ['Delaware DOT — I-95 Delaware Welcome Center'],
  MD: ['Maryland Transportation Authority (I-95 JFK Highway travel plazas)'],
};

/* Published parking the directory holds on each priority corridor today,
 * measured read-only 2026-07-27: mappable rows carrying a stated parking count.
 * These are the numbers the ranking reacts to. */
const CORRIDOR_PUBLISHED = {
  'I-95': 4,
  'I-80': 28,
  'I-90/I-94': 27, // I-90 15 + I-94 12
  'I-10': 23,
  'I-15': 7,
};

/* Weigh-station custodian differs from the rest-area custodian in many states:
 * enforcement usually sits with the state police / highway patrol CVE division,
 * not the DOT. Asking the wrong agency wastes a cycle. */
const WEIGH_CUSTODIAN = {
  CA: 'California Highway Patrol (CHP) commercial vehicle section',
  FL: 'Florida Highway Patrol — Office of Commercial Vehicle Enforcement',
  GA: 'Georgia Department of Public Safety — Motor Carrier Compliance Division',
  IL: 'Illinois State Police — Commercial Vehicle Enforcement',
  IN: 'Indiana State Police — Commercial Vehicle Enforcement Division',
  MD: 'Maryland State Police — Commercial Vehicle Enforcement Division',
  NC: 'NCDOT — State Highway Patrol Motor Carrier Enforcement',
  NY: 'NYSDOT — Motor Carrier Compliance / NY State Police CVEU',
  OH: 'Ohio State Highway Patrol — Licensing and Commercial Standards',
  PA: 'Pennsylvania State Police — Bureau of Patrol, CVSD',
  SC: 'SC State Transport Police',
  TX: 'Texas DPS — Commercial Vehicle Enforcement',
  VA: 'Virginia State Police — Motor Carrier Safety',
};

const ALL_STATES = [...new Set(Object.values(CORRIDORS).flat())].sort();

const entries = ALL_STATES.map((state) => {
  const onCorridors = Object.entries(CORRIDORS)
    .filter(([, sts]) => sts.includes(state))
    .map(([c]) => c);

  /* Score: each corridor contributes weight inversely proportional to what the
   * directory already publishes on it. A corridor with 4 published rows is
   * worth far more than one with 28. */
  const score = onCorridors.reduce((a, c) => a + 100 / (CORRIDOR_PUBLISHED[c] + 4), 0);

  return {
    state,
    agency: AGENCY[state] ?? `${state} state transportation agency`,
    priority_corridors: onCorridors,
    corridor_count: onCorridors.length,
    score: Math.round(score * 100) / 100,
    datasets_required: [
      'rest areas (truck parking status and space count)',
      'welcome centers (truck parking status)',
      'service plazas, where the state or an authority operates them',
      'weigh / inspection stations, as a SEPARATE category',
    ],
    weigh_station_custodian:
      WEIGH_CUSTODIAN[state] ?? 'state police / highway patrol CVE division — confirm',
    toll_authorities: TOLL_AUTHORITY[state] ?? [],
    entry_point:
      'state open-data / GIS portal, then the DOT GIS or asset-inventory group. UNVERIFIED — confirm on arrival.',
    access_status: 'BLOCKED at this environment egress proxy (connect_rejected, 403 CONNECT)',
    required_fields: [
      'facility_id (stable, namespaced by state)',
      'name',
      'facility_type (rest area | welcome center | service plaza | weigh station)',
      'route',
      'direction',
      'milepost_or_exit',
      'latitude',
      'longitude',
      'truck_spaces',
      'truck_parking_permitted (explicit boolean — REQUIRED for weigh stations)',
      'hours_or_seasonal_restrictions',
      'status (open | closed | seasonal | under construction)',
    ],
  };
})
  .sort((a, b) => b.score - a.score || a.state.localeCompare(b.state))
  .map((e, i) => ({ ...e, rank: i + 1 }));

const registry = {
  schema_version: 1,
  generated: '2026-07-27',
  purpose:
    'Ranked acquisition order for official rest-area, welcome-center, service-plaza and weigh-station datasets. Gate lines 5 and 6.',
  ranking_basis:
    'Computed from priority-corridor membership weighted inversely by the parking the directory already publishes on each corridor. I-95 dominates because it publishes 4 mappable parking rows nationwide.',
  corridor_published_baseline: CORRIDOR_PUBLISHED,
  network_status:
    'Every agency host, ArcGIS endpoint, FHWA and USDOT host is BLOCKED at this environment egress proxy. No URL here was fetched or verified. Confirm each entry point on arrival.',
  rules: {
    weigh_station_is_not_parking:
      'A weigh, inspection, scale, check station or port of entry is never counted as truck parking unless the authoritative source explicitly confirms legal parking is permitted.',
    no_inferred_coordinates:
      'No coordinate from a road midpoint, ZIP centroid, interpolation or geocoder guess.',
    no_invented_attributes:
      'Space count, hours, restrictions and amenities stay null unless the source states them.',
    directional_pairs_stay_separate:
      'A northbound and a southbound facility are two facilities and need two coordinates.',
    toll_authorities_are_separate_custodians:
      'A state DOT rest-area dataset does not contain turnpike or thruway service plazas. Those must be requested from the authority that operates them.',
  },
  federal: [
    {
      rank: 0,
      source: 'FHWA / BTS national truck parking layer (Jason’s Law survey)',
      agency: 'Federal Highway Administration / Bureau of Transportation Statistics',
      why_first:
        'One request covers all 50 states at once. Lower resolution and possibly stale, but it is the only single artifact that can move gate line 5 nationally in one step.',
      conflict_rule:
        'State DOT data WINS over FHWA on any conflict — the state is closer to the asset. Record the federal layer vintage and never let it override a fresher state dataset.',
      access_status: 'BLOCKED at this environment egress proxy',
      entry_point: 'data.transportation.gov / BTS geospatial catalogue. UNVERIFIED.',
    },
  ],
  states: entries,
};

registry.tier_thresholds = {
  tier_1: 'score >= 13.5 — carries more than one starved priority corridor',
  tier_2: 'score >= 12.5 — carries I-95',
  tier_3: 'everything else on a priority corridor',
};
for (const e of registry.states) e.tier = e.score >= 13.5 ? 1 : e.score >= 12.5 ? 2 : 3;
writeFileSync(`${DIR}/agency-registry.json`, JSON.stringify(registry, null, 2) + '\n');

/* ------------------------------------------------------------------ markdown */
/* Tiers are cut on SCORE, not rank, so a tied group is never split across a
 * boundary by an alphabetical accident. The two thresholds have meanings:
 *   ≥ 13.5  carries more than one starved priority corridor
 *   ≥ 12.5  carries I-95, which publishes 4 mappable parking rows nationwide */
const tierOf = (r) => (r.score >= 13.5 ? 1 : r.score >= 12.5 ? 2 : 3);
const md = [];
md.push('# Official agency acquisition registry — gate lines 5 and 6');
md.push('');
md.push('Generated by `scripts/generate-agency-registry.mjs`. Do not hand-edit;');
md.push('change the generator so the ranking stays reproducible.');
md.push('');
md.push('**Every agency host is blocked at this environment’s egress proxy** ');
md.push('(`connect_rejected`, 403 CONNECT). No URL here was fetched or verified.');
md.push('Entry points are the canonical place to start and must be confirmed on');
md.push('arrival. Nothing here asserts that a dataset exists at a given path today.');
md.push('');
md.push('---');
md.push('');
md.push('## Why this registry is the launch’s critical path');
md.push('');
md.push('Operator exports are obtainable — Love’s and Pilot both landed. Agency data');
md.push('is not, and gate line 5 needs **≥ 95 % of official public rest areas, welcome');
md.push('centers and service plazas**. Line 5 will still be open long after lines 2–4');
md.push('close, so it sets the launch date.');
md.push('');
md.push('## Ranking basis');
md.push('');
md.push('Rank is **computed**, not asserted: each state scores the sum over the');
md.push('priority corridors it carries, weighted inversely by the parking the');
md.push('directory already publishes on that corridor.');
md.push('');
md.push('| Corridor | Mappable published parking today | Weight |');
md.push('|---|--:|--:|');
for (const [c, n] of Object.entries(CORRIDOR_PUBLISHED)) {
  md.push(`| **${c}** | ${n} | ${(100 / (n + 4)).toFixed(1)} |`);
}
md.push('');
md.push('**I-95 dominates the ranking** because the directory publishes just **4**');
md.push('mappable parking rows on it nationwide. A state that carries I-95 is worth');
md.push('more than one that carries I-80, which already has 28.');
md.push('');
md.push('---');
md.push('');
md.push('## Ask the federal layer first');
md.push('');
const f = registry.federal[0];
md.push(`**${f.source}** — ${f.agency}`);
md.push('');
md.push(`${f.why_first}`);
md.push('');
md.push(`> **Conflict rule:** ${f.conflict_rule}`);
md.push('');
md.push('---');
md.push('');
md.push('## Ranked state order');
md.push('');
for (const tier of [1, 2, 3]) {
  const inTier = entries.filter((e) => tierOf(e) === tier);
  if (!inTier.length) continue;
  const label =
    tier === 1
      ? 'Tier 1 — one request unlocks more than one starved corridor'
      : tier === 2
        ? 'Tier 2 — the rest of I-95, the worst-covered corridor in the directory'
        : 'Tier 3 — completes the priority corridors, on better-covered routes';
  md.push(`### ${label}`);
  md.push('');
  md.push('| # | State | Agency | Priority corridors | Score |');
  md.push('|--:|---|---|---|--:|');
  for (const e of inTier) {
    md.push(
      `| ${e.rank} | **${e.state}** | ${e.agency} | ${e.priority_corridors.join(', ')} | ${e.score} |`,
    );
  }
  md.push('');
}
md.push('---');
md.push('');
md.push('## Toll and turnpike authorities are separate custodians');
md.push('');
md.push('A state DOT rest-area dataset **does not** contain turnpike service plazas.');
md.push('On the northeast I-95 / I-80 / I-90 corridors that is most of the truck-usable');
md.push('stopping capacity, so missing them leaves a hole exactly where coverage is');
md.push('worst.');
md.push('');
md.push('| State | Authority to request separately |');
md.push('|---|---|');
for (const [st, auths] of Object.entries(TOLL_AUTHORITY)) {
  for (const a of auths) md.push(`| ${st} | ${a} |`);
}
md.push('');
md.push('---');
md.push('');
md.push('## Weigh stations are a separate request, and a separate category');
md.push('');
md.push('Enforcement data usually sits with the **state police or highway patrol**,');
md.push('not the DOT. Asking the DOT for scale locations wastes a cycle.');
md.push('');
md.push('> A weigh, inspection, scale, check station or port of entry is **never**');
md.push('> counted as truck parking unless the authoritative source explicitly');
md.push('> confirms legal parking is permitted.');
md.push('');
md.push('They are captured at 100 % as their **own category** so a driver can see and');
md.push('avoid them.');
md.push('');
md.push('| State | Likely weigh-station custodian |');
md.push('|---|---|');
for (const e of entries.filter((x) => WEIGH_CUSTODIAN[x.state])) {
  md.push(`| ${e.state} | ${e.weigh_station_custodian} |`);
}
md.push('');
md.push('---');
md.push('');
md.push('## Fields every dataset must carry');
md.push('');
md.push('A checklist to verify on arrival — **not** a schema to code against before');
md.push('the file exists.');
md.push('');
for (const rf of entries[0].required_fields) md.push(`- \`${rf}\``);
md.push('');
md.push('`truck_parking_permitted` is **required** for any weigh or inspection');
md.push('station. Without it the row is captured as a weigh station and never as');
md.push('parking.');
md.push('');
md.push('## Rules that bind every one of these intakes');
md.push('');
for (const [k, v] of Object.entries(registry.rules)) {
  md.push(`- **${k.replace(/_/g, ' ')}** — ${v}`);
}
md.push('');

writeFileSync(`${DIR}/AGENCY-REGISTRY.md`, md.join('\n'));

console.log(`states ranked         ${entries.length}`);
console.log(
  `tier 1 (multi-corridor) ${entries
    .filter((e) => tierOf(e) === 1)
    .map((e) => e.state)
    .join(' ')}`,
);
console.log(
  `tier 2 (I-95 remainder)  ${entries
    .filter((e) => tierOf(e) === 2)
    .map((e) => e.state)
    .join(' ')}`,
);
console.log(
  `tier 3                   ${entries
    .filter((e) => tierOf(e) === 3)
    .map((e) => e.state)
    .join(' ')}`,
);
console.log(
  `toll authorities      ${Object.values(TOLL_AUTHORITY).flat().length} across ${Object.keys(TOLL_AUTHORITY).length} states`,
);
console.log(`weigh custodians      ${Object.keys(WEIGH_CUSTODIAN).length} identified`);
