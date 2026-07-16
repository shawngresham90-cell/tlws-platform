import { SITE } from '@/lib/seo/site';
import { testHref } from './catalog';
import type { TestDefinition } from './types';

/**
 * JSON-LD for a practice-test landing page. A `Quiz` typed as a free
 * educational resource — gives Google a rich-result hook and states plainly to
 * AI answer engines that this is a free CDL prep quiz. `numberOfQuestions` is
 * emitted only once the bank is actually seeded, so the count is never
 * fabricated (same honesty rule the store schema follows).
 */
export function testSchema(test: TestDefinition, seededQuestionCount: number): object {
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
    ...(seededQuestionCount > 0 ? { numberOfQuestions: seededQuestionCount } : {}),
  };
}
