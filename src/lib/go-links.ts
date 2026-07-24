/**
 * Short links for video descriptions and social bios.
 *
 * `truckinglifewithshawn.com/go/<slug>` 302s to the real page with YouTube
 * UTM parameters attached, so arrivals from the channel segment cleanly in
 * analytics (Top Sources → youtube, campaign = the slug). Memorable enough
 * to say out loud on camera.
 *
 * INTERNAL destinations only, strict allowlist — every target is a
 * confirmed-live internal route. A wrong or hostile slug must never redirect
 * off-site or dead-end a viewer, so unknown slugs fall back to the homepage
 * untagged. No arbitrary targets, no open redirects, no external affiliate
 * destinations, no personal data, no DB writes.
 */
export const GO_LINKS: Record<string, string> = {
  // Say-on-camera destinations — all confirmed-live static routes.
  'cdl-pre-school': '/cdl-pre-school',
  preschool: '/cdl-pre-school',
  academy: '/academy',
  apply: '/academy/apply',
  'practice-test': '/practice-tests',
  tests: '/practice-tests',
  directory: '/directory',
  'trip-planner': '/trip-planner',
  trip: '/trip-planner',
  'truck-parking': '/directory/parking',
  parking: '/directory/parking',
  books: '/books',
  store: '/store',
  sponsors: '/sponsors',
  sponsor: '/sponsors',
  founders: '/founders',
  knowledge: '/knowledge',
  'dot-tools': '/dot-tools',
};

/**
 * Build the tagged destination for a slug; null when the slug is unknown.
 *
 * - `Object.hasOwn` guard: "/go/constructor", "/go/__proto__", "/go/prototype"
 *   must miss, not resolve up the prototype chain onto a non-string.
 * - Existing destination query params are preserved; UTM params are appended.
 * - A destination hash (e.g. "/#newsletter") is preserved and placed last.
 */
export function resolveGoLink(slug: string): string | null {
  if (typeof slug !== 'string' || !Object.hasOwn(GO_LINKS, slug)) return null;
  const target = GO_LINKS[slug];

  const hashIndex = target.indexOf('#');
  const hash = hashIndex >= 0 ? target.slice(hashIndex + 1) : '';
  const withoutHash = hashIndex >= 0 ? target.slice(0, hashIndex) : target;

  const queryIndex = withoutHash.indexOf('?');
  const path = queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash;
  const existingQuery = queryIndex >= 0 ? withoutHash.slice(queryIndex + 1) : '';

  const params = new URLSearchParams(existingQuery);
  params.set('utm_source', 'youtube');
  params.set('utm_medium', 'video');
  params.set('utm_campaign', slug);

  return `${path}?${params.toString()}${hash ? `#${hash}` : ''}`;
}
