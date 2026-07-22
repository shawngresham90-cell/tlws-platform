import { SITE } from '@/lib/seo/site';

/**
 * Legal / compliance identity — the single source of truth for the Privacy
 * Policy and SMS Terms pages and for on-form consent copy. Only verified
 * facts from SITE plus the items below.
 *
 * OWNER TO CONFIRM before this ships publicly (see
 * docs/compliance/sms-10dlc-compliance.md):
 *  - `contactEmail` is a role address on the owned domain; provision the
 *    mailbox (or replace with the address you want published).
 *  - Have counsel review the Privacy Policy and SMS Terms wording — these
 *    pages are drafted to standard 10DLC/CTIA + general privacy practice,
 *    not as legal advice.
 */
export const LEGAL = {
  /** Registered entity (as stated in the footer trust block). */
  entity: 'Trucking Life Academy LLC',
  brand: SITE.brand,
  locale: `${SITE.city}, ${SITE.region}`,
  website: SITE.url,
  /** OWNER TO CONFIRM: provision this mailbox or replace before launch. */
  contactEmail: 'privacy@truckinglifewithshawn.com',
  /** Shown as "Last updated" on both legal pages. */
  effectiveDate: 'July 22, 2026',
  /** SMS program (campaign) name for 10DLC — matches the on-form consent scope. */
  smsProgramName: 'Trucking Life Academy Alerts',
} as const;
