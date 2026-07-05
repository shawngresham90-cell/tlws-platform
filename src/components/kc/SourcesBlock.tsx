import type { KcSource } from '@/lib/kc/types';

/** Sources / citations. Builds trust and E-E-A-T; external links get noopener. */
export function SourcesBlock({ sources }: { sources: KcSource[] }) {
  if (!sources?.length) return null;
  return (
    <section
      aria-labelledby="sources-heading"
      className="mt-12 rounded-card border border-line bg-asphalt-800 p-5"
    >
      <h2 id="sources-heading" className="eyebrow mb-3">
        Sources
      </h2>
      <ul className="space-y-2">
        {sources.map((s, i) => (
          <li key={i}>
            <a
              href={s.url}
              rel="noopener nofollow"
              target="_blank"
              className="text-sm text-signal underline hover:no-underline"
            >
              {s.label}
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
