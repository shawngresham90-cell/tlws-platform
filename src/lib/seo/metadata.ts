import type { Metadata } from 'next';
import { SITE } from './site';

/** Builds page metadata (title, description, canonical, OG, Twitter) uniformly. */
export function buildMetadata(opts?: {
  title?: string;
  description?: string;
  path?: string;
}): Metadata {
  const title = opts?.title ?? `${SITE.name} — CDL Training in ${SITE.city}, ${SITE.region}`;
  const description = opts?.description ?? SITE.description;
  const path = opts?.path ?? '/';
  const canonical = `${SITE.url}${path}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: 'website',
      url: canonical,
      siteName: SITE.name,
      title,
      description,
      locale: 'en_US',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
    robots: { index: true, follow: true },
  };
}
