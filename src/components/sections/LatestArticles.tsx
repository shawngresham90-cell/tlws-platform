import { Section, Button } from '@/components/ui';
import { SectionHeading } from './SectionHeading';

/**
 * Latest Articles. Placeholder cards now; wired to content_pages (published)
 * in a later milestone. Structured as <article> for AI + accessibility.
 */
const ARTICLES = [
  { title: 'The 3 DOT violations that cost drivers the most', tag: 'Regulations' },
  { title: 'How to read a roadside inspection report', tag: 'Roadside' },
  { title: 'WIOA funding for CDL school, explained', tag: 'Career' },
];

export function LatestArticles() {
  return (
    <Section id="articles" className="border-b border-line bg-asphalt-800">
      <SectionHeading eyebrow="Latest Articles" title="From the Knowledge Center" />
      <div className="grid gap-5 sm:grid-cols-3">
        {ARTICLES.map((a) => (
          <article
            key={a.title}
            className="flex flex-col rounded-card border border-line bg-asphalt p-6"
          >
            <p className="text-xs uppercase tracking-wide text-signal">{a.tag}</p>
            <h3 className="mt-2 flex-1 font-semibold text-ink">{a.title}</h3>
            <span className="mt-4 text-sm text-muted">Read →</span>
          </article>
        ))}
      </div>
      <div className="mt-9">
        <Button variant="ghost" href="/knowledge">
          All articles
        </Button>
      </div>
    </Section>
  );
}
