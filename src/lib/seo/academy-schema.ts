import { SITE } from './site';
import type { KcFaq } from '@/lib/kc/types';

/**
 * Academy-specific JSON-LD builders (Milestone 7). Additive on purpose — the
 * shared Organization/Person/WebSite/Breadcrumb builders live in `schema.tsx`
 * and are imported where needed, so nothing in Milestones 1–6 is modified.
 */

/** FAQPage — pair with the exact same array rendered on-screen so Google/AI see what users see. */
export function faqPageSchema(faqs: KcFaq[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.q,
      acceptedAnswer: { '@type': 'Answer', text: f.a },
    })),
  };
}

/** The CDL-A / ELDT program as a schema.org Course, provided by the Academy. */
export function courseSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    '@id': `${SITE.url}/academy/curriculum#course`,
    name: 'CDL-A Entry-Level Driver Training (ELDT)',
    description:
      'ELDT-compliant Class A CDL training — theory and behind-the-wheel range and public-road ' +
      'instruction on real equipment, taught by working drivers in Dalton, GA.',
    provider: {
      '@type': 'EducationalOrganization',
      '@id': `${SITE.url}/#organization`,
      name: SITE.name,
    },
    educationalCredentialAwarded:
      'Eligibility to test for a Class A Commercial Driver’s License (CDL-A)',
    occupationalCredentialAwarded: 'Class A Commercial Driver’s License (CDL-A)',
    inLanguage: 'en-US',
    hasCourseInstance: {
      '@type': 'CourseInstance',
      courseMode: 'onsite',
      location: {
        '@type': 'Place',
        name: SITE.name,
        address: {
          '@type': 'PostalAddress',
          addressLocality: SITE.city,
          addressRegion: SITE.region,
          addressCountry: 'US',
        },
      },
    },
  };
}

/**
 * Local-intent school node for the Dalton, GA landing page. Distinct @id so it
 * never collides with the site-wide #organization node, and declares the I-75
 * North Georgia service area for local search.
 */
export function localSchoolSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    '@id': `${SITE.url}/academy/cdl-school-dalton-ga#localschool`,
    name: `${SITE.name} — CDL School in ${SITE.city}, ${SITE.region}`,
    parentOrganization: { '@id': `${SITE.url}/#organization` },
    url: `${SITE.url}/academy/cdl-school-dalton-ga`,
    description:
      'Class A CDL school in Dalton, Georgia, off I-75 — ELDT-compliant training on real ' +
      'equipment, serving North Georgia and the surrounding I-75 corridor.',
    address: {
      '@type': 'PostalAddress',
      addressLocality: SITE.city,
      addressRegion: SITE.region,
      addressCountry: 'US',
    },
    areaServed: [
      'Dalton, GA',
      'Whitfield County, GA',
      'Calhoun, GA',
      'Chatsworth, GA',
      'Ringgold, GA',
      'Cleveland, TN',
      'Chattanooga, TN',
      'North Georgia',
      'I-75 corridor',
    ].map((name) => ({ '@type': 'Place', name })),
    sameAs: [SITE.social.youtube, SITE.social.facebook, SITE.social.tiktok],
  };
}
