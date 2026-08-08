/**
 * Maneuver text normalization — the one place provider prose is cleaned
 * up before a driver reads it on the card or hears it spoken.
 *
 * HERE v8 returns instruction text as sentences, and with `units=imperial`
 * those sentences carry more than the turn:
 *
 *   "Turn right onto Broad St. Go for 1.3 mi."
 *
 * That trailing distance is the length of the road AFTER the turn, while
 * the card's big line directly above reads "In 0.3 mi" — the distance TO
 * the turn. Two different distances in one glance, and the one the driver
 * must act on is the one they read first and smaller. Spoken guidance has
 * the same problem: "Go for one point three M I" is noise appended to
 * every single instruction.
 *
 * Nothing here invents text. Every function only removes or truncates, so
 * anything shown or spoken is still the provider's own wording.
 *
 * Pure: strings in, strings out. No clock, no I/O.
 */

/**
 * HERE's trailing segment-length sentence. Units are listed explicitly
 * rather than matched loosely, because `[^.]*` would stop inside the
 * number itself ("Go for 0.4 mi.").
 */
const DISTANCE_SENTENCE =
  /\s*\bGo for\s+[\d.,]+\s*(?:mi|miles?|ft|feet|yd|yards?|m|meters?|metres?|km|kilometers?|kilometres?)\b\.?/gi;

/**
 * Provider instruction text as a driver should see or hear it. Null only
 * for a missing or blank instruction — an instruction that consists of
 * nothing BUT the segment length keeps its original wording, because a
 * blank maneuver line is worse than a redundant one.
 */
export function normalizeInstruction(instruction: string | null | undefined): string | null {
  if (typeof instruction !== 'string') return null;
  const collapsed = instruction.replace(/\s+/g, ' ').trim();
  if (collapsed === '') return null;
  const stripped = collapsed
    .replace(DISTANCE_SENTENCE, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,;])/g, '$1')
    .trim();
  return stripped === '' ? collapsed : stripped;
}

/** Longest road name worth putting on the card. */
export const MAX_ROAD_NAME = 40;

/** Where the road name starts in an instruction. */
const ROAD_PREFIX = /\b(?:onto|towards?|on)\s+(.+)/i;

/**
 * Clause starters that follow a road name rather than belong to it —
 * HERE's own connectors: "onto I-75 N toward Chattanooga", "on Broad St
 * for 1.3 mi", "onto Ringgold Rd then keep left".
 */
const CLAUSE_START = /\s(?:toward|towards|for|then|and then)\b/i;

/** A "road name" that is really a direction phrase is not a road name. */
const NOT_A_ROAD = /^(?:the\s+)?(?:left|right|ramp|exit|highway|freeway|street|road)$/i;

/**
 * Text up to the first sentence end, leaving abbreviation dots alone.
 * "Chestnut St. Go for 0.2 mi." → "Chestnut St", but "U.S. 41" survives
 * whole because the dot after a lone initial is part of the name.
 */
function firstSentence(text: string): string {
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch !== '.' && ch !== ';' && ch !== ',') continue;
    const next = text[i + 1];
    // A dot inside a token ("I-24", the first dot of "U.S.") never ends
    // a sentence.
    if (next !== undefined && next !== ' ' && next !== '\n' && next !== '\t') continue;
    // "U.S. 41", "N.C. 12": a single letter preceded by its own dot is an
    // initial, and the dot after it belongs to the name.
    if (ch === '.' && i >= 2 && text[i - 2] === '.' && /[A-Za-z]/.test(text[i - 1])) continue;
    return text.slice(0, i);
  }
  return text;
}

/**
 * Best-effort road name out of a provider instruction.
 *
 * HERE's turn-by-turn text names the road the maneuver puts you on
 * ("Turn right onto Battlefield Parkway"), so the name is genuinely IN the
 * data — it is read here, never invented. A dedicated field would be
 * better (it needs `return=spans` with road names, a provider-request
 * change that is out of scope for a UI milestone), so anything that does
 * not match an explicit "onto"/"toward"/"on" phrasing returns null and the
 * card simply shows no road line.
 *
 * Only the FIRST sentence is read. HERE's arrival text ends "It will be on
 * the right." — scanning the whole string would happily report the road
 * name as "the right".
 */
export function roadNameFromInstruction(instruction: string | null | undefined): string | null {
  if (typeof instruction !== 'string' || instruction.trim() === '') return null;
  const match = ROAD_PREFIX.exec(firstSentence(instruction));
  if (match === null) return null;
  let name = match[1];
  // A trailing clause is not part of the name. Without this the card read
  // "on Old Mill Road toward the receiving gate" directly under the very
  // instruction it was extracted from (measured at 568x320 in Chromium).
  const clause = CLAUSE_START.exec(name);
  if (clause !== null) name = name.slice(0, clause.index);
  name = name.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > MAX_ROAD_NAME) return null;
  if (NOT_A_ROAD.test(name)) return null;
  return name;
}
