/**
 * First-touch attribution, shared between the site-wide capture component
 * and the application form. utm_* params from the FIRST tagged URL a visitor
 * lands on (any page) are persisted in sessionStorage; the outside referrer
 * rides along. Bounded to the API's utm contract (≤20 keys, key ≤40 chars,
 * value ≤200). No PII, no cookies, session-scoped by design.
 */
const UTM_KEY = 'tlws-utm-first-touch';

/** The API's `utm` contract (lib/api/schemas.ts), enforced client-side too. */
const MAX_KEYS = 20;
const MAX_KEY = 40;
const MAX_VALUE = 200;

/** Capture from the current URL/referrer into sessionStorage (client only). */
export function captureAttribution(): void {
  try {
    const stored = sessionStorage.getItem(UTM_KEY);
    const utm: Record<string, string> = stored
      ? (JSON.parse(stored) as Record<string, string>)
      : {};
    const params = new URLSearchParams(window.location.search);
    let hasNew = false;
    params.forEach((value, key) => {
      if (/^utm_[a-z_]{1,32}$/i.test(key) && value && !utm[key.toLowerCase()]) {
        utm[key.toLowerCase()] = value.slice(0, MAX_VALUE);
        hasNew = true;
      }
    });
    if (!utm.referrer && document.referrer && !document.referrer.includes(location.hostname)) {
      utm.referrer = document.referrer.slice(0, MAX_VALUE);
      hasNew = true;
    }
    if (hasNew) sessionStorage.setItem(UTM_KEY, JSON.stringify(utm));
  } catch {
    /* storage blocked — attribution is best-effort */
  }
}

/** Read the stored first-touch attribution, capped to the API contract. */
export function readAttribution(): Record<string, string> {
  try {
    const stored = sessionStorage.getItem(UTM_KEY);
    if (!stored) return {};
    const utm = JSON.parse(stored) as Record<string, string>;
    return bound(Object.fromEntries(Object.entries(utm)));
  } catch {
    return {};
  }
}

/** utm_* params on the CURRENT url only. */
export function currentUrlUtm(): Record<string, string> {
  const utm: Record<string, string> = {};
  try {
    const params = new URLSearchParams(window.location.search);
    params.forEach((value, key) => {
      if (/^utm_[a-z_]{1,32}$/i.test(key) && value)
        utm[key.toLowerCase()] = value.slice(0, MAX_VALUE);
    });
  } catch {
    /* no window (SSR) — best-effort */
  }
  return utm;
}

/**
 * The `utm` map every lead-capture form should send.
 *
 * Reading the current URL alone loses the source as soon as the visitor
 * navigates: a driver who arrives on `/go/academy` (which tags
 * utm_source=youtube&utm_medium=video&utm_campaign=academy), reads a page, and
 * then signs up on the home page submits an untagged lead. First touch is
 * already persisted site-wide by AttributionCapture, so it is the primary
 * source here; the current URL is the fallback for a session with storage
 * blocked, and `extra` is caller-supplied context (e.g. the founder tier).
 *
 * Precedence: extra > first touch > current URL. Bounded to the API contract.
 */
export function leadAttribution(extra: Record<string, string> = {}): Record<string, string> {
  return bound({ ...currentUrlUtm(), ...readAttribution(), ...extra }, Object.keys(extra));
}

/**
 * Enforce the API's utm contract (≤20 keys, key ≤40 chars, value ≤200).
 * `keep` names the keys that must survive the 20-key cap — caller-supplied
 * context would otherwise be the arbitrary entry that gets dropped.
 */
function bound(map: Record<string, string>, keep: string[] = []): Record<string, string> {
  const entries = Object.entries(map).filter(
    ([k, v]) => k.length <= MAX_KEY && typeof v === 'string',
  );
  const priority = new Set(keep);
  const ordered = [
    ...entries.filter(([k]) => priority.has(k)),
    ...entries.filter(([k]) => !priority.has(k)),
  ];
  return Object.fromEntries(ordered.slice(0, MAX_KEYS).map(([k, v]) => [k, v.slice(0, MAX_VALUE)]));
}
