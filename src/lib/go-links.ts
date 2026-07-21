/**
 * Short links for video descriptions and social bios (Block 2, M4).
 *
 * `truckinglifewithshawn.com/go/<slug>` 302s to the real page with YouTube
 * UTM parameters attached, so arrivals from the channel segment cleanly in
 * analytics (Top Sources → youtube, campaign = the slug). Memorable enough
 * to say out loud on camera.
 *
 * Internal destinations only — a wrong slug must never dead-end a viewer,
 * so unknown slugs fall back to the homepage untagged.
 */
export const GO_LINKS: Record<string, string> = {
  // Say-on-camera destinations
  'dot-guide': '/knowledge/dot-compliance',
  hos: '/knowledge/hours-of-service',
  parking: '/directory/parking',
  directory: '/directory',
  tests: '/practice-tests',
  trip: '/trip-planner',
  books: '/books',
  preschool: '/cdl-pre-school',
  apply: '/academy/apply',
  academy: '/academy',
  founders: '/founders',
  sponsor: '/sponsors',
  newsletter: '/#newsletter',
};

/** Build the tagged destination for a slug; null when the slug is unknown. */
export function resolveGoLink(slug: string): string | null {
  const target = GO_LINKS[slug];
  if (!target) return null;
  const [path, hash] = target.split('#');
  const params = new URLSearchParams({
    utm_source: 'youtube',
    utm_medium: 'video',
    utm_campaign: slug,
  });
  return `${path}?${params.toString()}${hash ? `#${hash}` : ''}`;
}
