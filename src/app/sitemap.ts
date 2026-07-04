import type { MetadataRoute } from 'next';
import { SITE } from '@/lib/seo/site';

/**
 * Sitemap. Homepage now; future modules append their routes here as they ship.
 * Keeping it code-generated means new sections are one line, not a manual XML edit.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [{ url: SITE.url, lastModified: now, changeFrequency: 'weekly', priority: 1 }];
}
