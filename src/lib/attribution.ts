/**
 * First-touch attribution, shared between the site-wide capture component
 * and the application form. utm_* params from the FIRST tagged URL a visitor
 * lands on (any page) are persisted in sessionStorage; the outside referrer
 * rides along. Bounded to the API's utm contract (≤20 keys, key ≤40 chars,
 * value ≤200). No PII, no cookies, session-scoped by design.
 */
const UTM_KEY = 'tlws-utm-first-touch';

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
        utm[key.toLowerCase()] = value.slice(0, 200);
        hasNew = true;
      }
    });
    if (!utm.referrer && document.referrer && !document.referrer.includes(location.hostname)) {
      utm.referrer = document.referrer.slice(0, 200);
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
    return Object.fromEntries(Object.entries(utm).slice(0, 20));
  } catch {
    return {};
  }
}
