import type { Metadata } from 'next';
import { SITE } from './site';

/** Builds page metadata (title, description, canonical, OG, Twitter) uniformly. */
export function buildMetadata(opts?: {
  title?: string;
  description?: string;
  path?: string;
  noindex?: boolean;
  image?: string;
  type?: 'website' | 'article';
}): Metadata {
  const title = opts?.title ?? `${SITE.name} — CDL Training in ${SITE.city}, ${SITE.region}`;
  const description = opts?.description ?? SITE.description;
  const path = opts?.path ?? '/';
  const canonical = `${SITE.url}${path}`;

  return {
    title,
    description,
    // Resolves file-convention social images (opengraph-image.tsx) and any
    // relative asset URLs against the production origin.
    metadataBase: new URL(SITE.url),
    alternates: { canonical },
    openGraph: {
      type: opts?.type ?? 'website',
      url: canonical,
      siteName: SITE.name,
      title,
      description,
      locale: 'en_US',
      // Omit `images` entirely when unset so file-convention images
      // (opengraph-image.tsx) can flow through.
      ...(opts?.image ? { images: [{ url: opts.image }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(opts?.image ? { images: [opts.image] } : {}),
    },
    robots: opts?.noindex ? { index: false, follow: false } : { index: true, follow: true },
  };
}
