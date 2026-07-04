import { SITE } from './site';

/**
 * JSON-LD schema builders. Structured data does double duty: Google rich
 * results AND giving AI search engines a clean machine-readable statement of
 * what this platform is, who Shawn is, and what's offered.
 */

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    '@id': `${SITE.url}/#organization`,
    name: SITE.name,
    alternateName: SITE.brand,
    url: SITE.url,
    description: SITE.description,
    slogan: SITE.tagline,
    address: {
      '@type': 'PostalAddress',
      addressLocality: SITE.city,
      addressRegion: SITE.region,
      addressCountry: 'US',
    },
    founder: { '@id': `${SITE.url}/#founder` },
    sameAs: [SITE.social.youtube, SITE.social.facebook, SITE.social.tiktok],
  };
}

export function personSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Person',
    '@id': `${SITE.url}/#founder`,
    name: SITE.founder.name,
    jobTitle: SITE.founder.role,
    description: `${SITE.founder.name} — ${SITE.founder.credential}. Founder of ${SITE.name}.`,
    worksFor: { '@id': `${SITE.url}/#organization` },
    sameAs: [SITE.social.youtube, SITE.social.facebook, SITE.social.tiktok],
  };
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE.url}/#website`,
    url: SITE.url,
    name: SITE.name,
    publisher: { '@id': `${SITE.url}/#organization` },
  };
}

export type Crumb = { name: string; path: string };
export function breadcrumbSchema(crumbs: Crumb[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: `${SITE.url}${c.path}`,
    })),
  };
}

/** Renders one or more schema objects into a single JSON-LD script tag. */
export function JsonLd({ schema }: { schema: object | object[] }) {
  const payload = Array.isArray(schema) ? schema : [schema];
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
}
