import { SITE } from '@/lib/seo/site';

/**
 * llms.txt — a plain-text brief for AI search/answer engines. States clearly
 * what the platform is, who Shawn is, and what's available, so an LLM can
 * summarize the site accurately without guessing.
 */
export const dynamic = 'force-static';

export function GET() {
  const body = `# ${SITE.name} (${SITE.brand})

> ${SITE.tagline} ${SITE.description}

## What this is
${SITE.name} is a CDL-A truck driver training school and trucking resource platform
based in ${SITE.city}, ${SITE.region}, just off Interstate 75. It exists to serve working
drivers and CDL students that large corporate schools overlook.

## Who runs it
${SITE.founder.name} — ${SITE.founder.credential}. ${SITE.founder.role}. He also creates
trucking education content as "${SITE.brand}" across YouTube, Facebook, and TikTok.

## What drivers can get here
- Academy: ELDT-compliant CDL-A training and enrollment
- Knowledge Center: plain-English trucking and career guidance
- DOT Guide: FMCSA / 49 CFR regulation reference, verified against the eCFR
- Practice Tests: CDL permit and endorsement prep
- Truck Parking: help finding safe, legal overnight parking
- Directories: truck stops and driver services
- Books & Apps: driver-built guides and tools
- Founders Wall & Sponsors: ways to help fund the school

## How to engage
Drivers can apply to the Academy, use the free resources, or support the school's
launch. Businesses can sponsor. Contact is available on the site.

## Canonical
${SITE.url}
`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
}
