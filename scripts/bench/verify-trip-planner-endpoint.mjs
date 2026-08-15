/**
 * The quote endpoint, driven over real HTTP against a running production
 * server rather than read as code.
 *
 * WHY THIS EXISTS SEPARATELY FROM THE UNIT HARNESSES. Both defects this
 * found live in the WIRING between layers, which is exactly what a unit
 * test stubs away: the safety buffer never left the browser because the
 * request schema had no field for it, and the Canadian refusal could
 * never fire because the endpoint passed a hardcoded country. Every
 * engine involved was individually correct and individually tested.
 *
 * Run:
 *   npx next build && npx next start -p 3311 &
 *   node scripts/bench/verify-trip-planner-endpoint.mjs
 *
 * Set BASE to point at a different origin.
 */
const BASE = process.env.BASE ?? 'http://127.0.0.1:3311';

const ATL = { lat: 33.749, lng: -84.388 };
const KNX = { lat: 35.9606, lng: -83.9207 };
const CALGARY = { lat: 51.0447, lng: -114.0719 };
const EDMONTON = { lat: 53.5461, lng: -113.4938 };
const DETROIT = { lat: 42.3314, lng: -83.0458 };
const WINDSOR = { lat: 42.3149, lng: -83.0364 };

let pass = 0;
let fail = 0;
function check(name, ok, detail) {
  if (ok) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name} — ${JSON.stringify(detail)}`);
  }
}

async function quote(body) {
  const res = await fetch(`${BASE}/api/trip-planner/quote`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

const CLOCKS = {
  drivingUsedMin: 180,
  windowElapsedMin: 240,
  drivingSinceBreakMin: 120,
  cycleUsedMin: 1200,
  cycleRule: '70/8',
};

const base = (over = {}) => ({
  origin: { label: 'Atlanta', position: ATL, country: 'US' },
  destination: { label: 'Knoxville', position: KNX, country: 'US' },
  departAtMs: 1786000000000,
  clocks: CLOCKS,
  ...over,
});

console.log('\n== the buffer travels UI → request → endpoint → plan ==');
for (const bufferMin of [15, 30, 45, 60]) {
  const { status, json } = await quote(base({ bufferMin }));
  check(
    `${bufferMin} min: request accepted`,
    status === 200 && json.ok === true,
    json.error ?? status,
  );
  if (!json.ok) continue;
  check(
    `${bufferMin} min: the parking filter used the chosen buffer`,
    json.lastStop.bufferMin === bufferMin,
    json.lastStop.bufferMin,
  );
  check(
    `${bufferMin} min: the plan window used the chosen buffer`,
    json.plan.window !== null && json.plan.window.bufferMin === bufferMin,
    json.plan.window,
  );
  check(
    `${bufferMin} min: the stop target is exactly the buffer earlier than the limit`,
    json.plan.window !== null &&
      json.plan.window.clockLimitMin - json.plan.window.stopTargetMin === bufferMin,
    json.plan.window,
  );
}

console.log('\n== a wider buffer really does shorten the usable day ==');
{
  const a = (await quote(base({ bufferMin: 15 }))).json;
  const b = (await quote(base({ bufferMin: 60 }))).json;
  check(
    '60 min leaves less driving than 15 min',
    a.ok && b.ok && b.plan.window.stopTargetMin < a.plan.window.stopTargetMin,
    { at15: a.ok && a.plan.window.stopTargetMin, at60: b.ok && b.plan.window.stopTargetMin },
  );
}

console.log('\n== every region shape gets its own answer ==');
const REGIONS = [
  {
    name: 'US → US',
    body: base(),
    expect: (w) => w.ok === true || w.reason === 'timing-unavailable',
    describe: 'never refused on region grounds',
  },
  {
    name: 'CA → CA',
    body: base({
      origin: { label: 'Calgary', position: CALGARY, country: 'CA' },
      destination: { label: 'Edmonton', position: EDMONTON, country: 'CA' },
    }),
    expect: (w) => w.ok === false && w.reason === 'region-unsupported',
    describe: 'Canadian coverage is disclosed, not implied',
  },
  {
    name: 'US → CA',
    body: base({
      destination: { label: 'Calgary', position: CALGARY, country: 'CA' },
    }),
    expect: (w) => w.ok === false && w.reason === 'cross-border',
    describe: 'a northbound crossing is half-covered, not Canadian',
  },
  {
    name: 'CA → US',
    body: base({
      origin: { label: 'Calgary', position: CALGARY, country: 'CA' },
      destination: { label: 'Atlanta', position: ATL, country: 'US' },
    }),
    expect: (w) => w.ok === false && w.reason === 'cross-border',
    describe: 'a southbound crossing is half-covered, not Canadian',
  },
  {
    name: 'Detroit → Windsor (attested)',
    body: base({
      origin: { label: 'Detroit', position: DETROIT, country: 'US' },
      destination: { label: 'Windsor', position: WINDSOR, country: 'CA' },
    }),
    expect: (w) => w.ok === false && w.reason === 'cross-border',
    describe: 'never called purely Canadian nor purely American',
  },
  {
    name: 'Detroit → Windsor (no claims)',
    body: base({
      origin: { label: 'Detroit', position: DETROIT },
      destination: { label: 'Windsor', position: WINDSOR },
    }),
    expect: (w) => w.ok === false && w.reason === 'country-unknown',
    describe: 'unplaceable is said out loud rather than guessed',
  },
];
for (const r of REGIONS) {
  const { json } = await quote(r.body);
  check(`${r.name}: request accepted`, json.ok === true, json.error);
  if (!json.ok) continue;
  check(`${r.name}: ${r.describe}`, r.expect(json.plan.weather), json.plan.weather);
}

console.log('\n== a fallback estimate claims nothing ==');
{
  // No routing key is configured in this environment, so every quote here
  // IS the estimate path — which is exactly what makes this checkable.
  const { json } = await quote(base({ bufferMin: 45 }));
  if (json.ok) {
    const p = json.plan;
    const claims = {
      liveTraffic: p.traffic.confidence === 'live',
      clockGeography: p.clockLimit.kind !== 'none' || p.stopTarget.kind !== 'none',
      breakGeography: p.breakMarker !== null || p.breakPlan?.required === true,
      parkingEligibility: p.parking.length > 0 || p.map.parking.length > 0,
      timedWeather: p.weather.ok === true,
      drawnRoute: p.map.route.length > 0,
    };
    check(
      'estimate: no live traffic, clock, break, parking, weather or road claimed',
      Object.values(claims).every((c) => c === false),
      claims,
    );
    check(
      'estimate: and the route summary says it is an estimate',
      json.routeSummary.isEstimate === true,
      json.routeSummary,
    );
  }
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail > 0 ? 1 : 0);
