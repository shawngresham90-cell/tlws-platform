import { SITE } from '@/lib/seo/site';
import { testHref } from './catalog';
import type { TestDefinition } from './types';

/**
 * JSON-LD for a practice-test landing page. A `Quiz` typed as a free
 * educational resource — states plainly to Google and AI answer engines that
 * this is a free CDL prep quiz. Only schema.org-recognized properties are
 * emitted (there is no numberOfQuestions in the vocabulary); when the runner
 * ships, per-question `hasPart` Question entities become the count signal —
 * the shape Google's practice-problems rich result actually reads.
 */
export function testSchema(test: TestDefinition): object {
  return {
    '@context': 'https://schema.org',
    '@type': 'Quiz',
    name: test.seoTitle,
    description: test.seoDescription,
    url: `${SITE.url}${testHref(test.slug)}`,
    educationalUse: 'CDL permit exam preparation',
    educationalLevel: 'Professional Certification',
    about: { '@type': 'Thing', name: `CDL ${test.title}` },
    provider: { '@id': `${SITE.url}/#organization` },
    isAccessibleForFree: true,
  };
}
