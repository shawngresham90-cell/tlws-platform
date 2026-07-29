/**
 * Conservative route-text parser for the CAT Scale source's unstructured
 * `InterstateAddress` field, plus host-name helpers. Pure functions, no
 * side effects — imported by the local-only intake tool AND by the CI test
 * harness (which must run without the proprietary CSV present).
 *
 * Honesty rules:
 * - A route is recorded only when exactly one unambiguous designation is
 *   present; multiple designations are classified 'multiple-*' and carry
 *   no position.
 * - An exit is recorded only as a single strict token on an interstate.
 * - A mile marker is recorded ONLY from an explicit "mile marker / milepost
 *   / MM n" token. An exit number is NEVER copied into the mileMarker
 *   field.
 * - A direction is recorded only from an explicit northbound/SB-style token.
 */

export function parseRouteText(text) {
  const t = ` ${text} `;
  const interstates = [...t.matchAll(/\bI[- ]?(\d{1,3})\b/gi)].map((m) => `I-${m[1]}`);
  const uniqueInterstates = [...new Set(interstates)];
  const usRoutes = [...t.matchAll(/\b(?:US|U\.S\.)\s?[- ]?\s?(?:Hwy\s*)?(\d{1,3})\b/gi)].map(
    (m) => `US-${m[1]}`,
  );
  const stateRoutes = [
    ...t.matchAll(/\b(?:SR|State (?:Route|Highway|Hwy))\s?[- ]?\s?(\d{1,4})\b/gi),
  ].map((m) => `SR-${m[1]}`);
  const toll = /\bturnpike\b|\btoll\b|\btollway\b/i.test(t);

  let routeClass = 'unknown';
  let route = null;
  if (uniqueInterstates.length === 1) {
    routeClass = 'interstate';
    route = uniqueInterstates[0];
  } else if (uniqueInterstates.length > 1) {
    routeClass = 'multiple-interstates';
  } else if (toll) {
    routeClass = 'toll';
  } else if (usRoutes.length === 1 && stateRoutes.length === 0) {
    routeClass = 'us-route';
    route = usRoutes[0];
  } else if (stateRoutes.length === 1 && usRoutes.length === 0) {
    routeClass = 'state-route';
    route = stateRoutes[0];
  } else if (usRoutes.length + stateRoutes.length > 1) {
    routeClass = 'multiple-routes';
  }

  // Exit: single, strict, not part of a range/compound.
  const exitMatches = [...t.matchAll(/\bexit\s*#?\s*(\d{1,4})\s*([A-Za-z])?(?![\w/-])/gi)];
  let exit = null;
  if (exitMatches.length === 1 && routeClass === 'interstate') {
    exit = `${exitMatches[0][1]}${(exitMatches[0][2] ?? '').toUpperCase()}`;
  }

  // Mile marker: ONLY an explicit token. Never derived from the exit.
  const mm = /\b(?:mile\s*marker|milepost|mm)\s*#?\s*(\d{1,4}(?:\.\d)?)\b/i.exec(t);
  const mileMarker = mm ? Number.parseFloat(mm[1]) : null;

  // Direction: explicit token only.
  const dir = /\b(north|south|east|west)bound\b/i.exec(t) ?? /\b([NSEW])B\b/.exec(t);
  const DIRECTION = { N: 'northbound', S: 'southbound', E: 'eastbound', W: 'westbound' };
  const direction = dir
    ? dir[1].length === 1
      ? DIRECTION[dir[1].toUpperCase()]
      : `${dir[1].toLowerCase()}bound`
    : null;

  return { routeClass, route, exit, mileMarker, direction };
}

const BRANDS = [
  ['loves', /love'?s/i],
  ['pilot', /pilot/i],
  ['flying-j', /flying\s*j/i],
  ['ta', /\btravel\s*centers?\b|\bta\b(?!\w)/i],
  ['petro', /petro/i],
  ['one9', /one\s*9/i],
  ['road-ranger', /road\s*ranger/i],
  ['speedway', /speedway/i],
  ['sapp', /sapp/i],
  ['bosselman', /bosselman/i],
  ['kwik', /kwik/i],
  ['quiktrip', /quik\s*trip|\bqt\b/i],
  ['buc-ees', /buc-?ee/i],
  ['casey', /casey/i],
  ['maverik', /maverik/i],
  ['racetrac', /race\s*trac/i],
  ['husky', /husky/i],
];

export function hostBrand(name) {
  for (const [key, re] of BRANDS) if (re.test(name)) return key;
  return null;
}

/**
 * Host STORE number ("Love's #368" → "368"). This is the host chain's store
 * number — it is NOT a CAT Scale number and must never be matched against
 * one.
 */
export function hostStoreNumber(name) {
  const m = /#\s*(\d{1,5})\b/.exec(name);
  return m ? m[1] : null;
}
