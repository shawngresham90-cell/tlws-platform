import Link from 'next/link';
import { conversionsFor } from '@/lib/kc/conversions';

/**
 * Contextual next steps under a Knowledge Center article — the two platform
 * destinations most relevant to what the reader just finished. Additive
 * block; article content is untouched.
 */
export function KcNextSteps({ categorySlug }: { categorySlug: string }) {
  const steps = conversionsFor(categorySlug);
  return (
    <aside
      aria-label="Keep going"
      className="mt-10 rounded-card border border-line bg-asphalt-800 p-5"
    >
      <p className="text-xs font-semibold uppercase tracking-widest text-signal">Keep going</p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        {steps.map((s) => (
          <div key={s.href} className="rounded-card border border-line bg-asphalt p-4">
            <p className="font-display text-base uppercase text-ink">{s.title}</p>
            <p className="mt-1 text-sm text-muted">{s.blurb}</p>
            <Link
              href={s.href}
              className="mt-2 inline-block text-sm font-semibold text-signal hover:underline"
            >
              {s.cta} →
            </Link>
          </div>
        ))}
      </div>
    </aside>
  );
}
