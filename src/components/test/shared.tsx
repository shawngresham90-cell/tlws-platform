import Link from 'next/link';
import { testHref } from '@/lib/tests/catalog';

/**
 * Pieces shared VERBATIM by the Study and Timed runners (Milestone 3 review).
 * The runners intentionally diverge on answer semantics and feedback — only
 * the byte-identical parts live here, so an accessibility or styling fix
 * lands in both modes at once. No 'use client' directive: server pages import
 * TestNotOpenPanel, and the client runners can import all of it freely.
 */

/**
 * Base classes for every answer-choice button: full-width ≥44px touch target
 * plus the site's focus-visible ring. Mode-specific state colors are appended
 * by each runner.
 */
export const CHOICE_BUTTON_BASE =
  'flex min-h-[44px] w-full items-start gap-3 rounded-card border px-4 py-3 text-left ' +
  'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal ' +
  'focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt';

/** Pre-hydration placeholder panel — identical chrome across all three runners. */
export function LoadingPanel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-card border border-line bg-asphalt-800 p-8 text-muted" role="status">
      {children}
    </div>
  );
}

/** "Question X of N" header + answered-count progressbar — identical in both modes. */
export function QuizProgress({
  currentIndex,
  total,
  answered,
  right,
}: {
  currentIndex: number;
  total: number;
  answered: number;
  /** Optional right-hand slot (the Timed runner's countdown). */
  right?: React.ReactNode;
}) {
  return (
    <div className="mb-6">
      <div className="flex items-baseline justify-between gap-4">
        <p className="text-sm font-semibold uppercase tracking-wide text-muted">
          Question {currentIndex + 1} of {total}
        </p>
        {right ?? <p className="text-sm text-muted">{answered} answered</p>}
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={answered}
        aria-label="Questions answered"
        className="mt-2 h-1.5 w-full overflow-hidden rounded-card bg-asphalt-700"
      >
        <div
          className="h-full bg-signal transition-all"
          style={{ width: `${total === 0 ? 0 : Math.round((answered / total) * 100)}%` }}
        />
      </div>
      {right && <p className="mt-1 text-right text-xs text-muted">{answered} answered</p>}
    </div>
  );
}

/** The honest zero-question guard, shared by the study and timed routes. */
export function TestNotOpenPanel({ slug, title }: { slug: string; title: string }) {
  return (
    <div className="mt-8 rounded-card border border-line bg-asphalt-800 p-8">
      <h2 className="font-display text-xl uppercase text-signal">This test isn&apos;t open yet</h2>
      <p className="mt-3 text-muted">
        The {title} question bank is being finalized. Check the test page for the latest — it goes
        live the moment the bank does.
      </p>
      <p className="mt-4">
        <Link href={testHref(slug)} className="font-semibold text-signal hover:underline">
          ← Back to {title}
        </Link>
      </p>
    </div>
  );
}
