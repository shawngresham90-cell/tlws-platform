import { Container } from '@/components/ui';
import { LEGAL } from '@/lib/legal/company';

/**
 * Shared masthead + prose shell for the static legal pages (Privacy Policy,
 * SMS Terms). Plain, readable, Steel & Sodium — a compliance surface, not a
 * marketing one. Content is authored as children; headings use <h2>.
 */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="bg-asphalt">
      <div className="border-b border-line">
        <Container className="py-12 sm:py-16">
          <p className="eyebrow">{LEGAL.entity}</p>
          <h1 className="display-hero mt-3 max-w-3xl text-4xl sm:text-5xl">{title}</h1>
          <p className="mt-4 text-sm text-muted">Last updated {LEGAL.effectiveDate}</p>
        </Container>
      </div>
      <Container className="py-12">
        <div className="legal-prose max-w-3xl">{children}</div>
      </Container>
    </article>
  );
}
