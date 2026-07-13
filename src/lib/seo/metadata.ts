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
    alternates: { canonical },
    openGraph: {
      type: opts?.type ?? 'website',
      url: canonical,
      siteName: SITE.name,
      title,
      description,
      locale: 'en_US',
      images: opts?.image ? [{ url: opts.image }] : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: opts?.image ? [opts.image] : undefined,
    },
    // noindex pages still pass link equity into the internal mesh (SEO audit #4).
    robots: opts?.noindex ? { index: false, follow: true } : { index: true, follow: true },
  };
}
