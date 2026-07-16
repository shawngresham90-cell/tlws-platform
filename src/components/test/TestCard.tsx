import Link from 'next/link';
import { testHref } from '@/lib/tests/catalog';
import type { TestDefinition } from '@/lib/tests/types';

/**
 * Practice Tests hub card — one test. Links to the test's landing page. Shows
 * the seeded question count when the bank is live, or a quiet "Coming soon"
 * when it is not (foundation state — the runner lands in Milestone 2).
 */
export function TestCard({
  test,
  seededQuestionCount,
}: {
  test: TestDefinition;
  seededQuestionCount: number;
}) {
  const live = seededQuestionCount > 0;
  return (
    <Link
      href={testHref(test.slug)}
      className="group flex flex-col rounded-card border border-line bg-asphalt-800 p-6 transition-colors hover:border-signal"
    >
      <div className="flex items-start justify-between gap-4">
        <span className="text-3xl" aria-hidden="true">
          {test.icon}
        </span>
        {test.endorsementCode && (
          <span className="rounded-card border border-line px-2 py-1 text-xs font-semibold uppercase tracking-wide text-muted">
            {test.endorsementCode} endorsement
          </span>
        )}
      </div>
      <h3 className="mt-4 font-display text-xl uppercase text-ink group-hover:text-signal">
        {test.title}
      </h3>
      <p className="mt-2 flex-1 text-sm text-muted">{test.shortDescription}</p>
      <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-signal">
        {live
          ? `${seededQuestionCount} questions · ${test.passThresholdPct}% to pass`
          : 'Question bank coming soon'}
      </p>
    </Link>
  );
}
