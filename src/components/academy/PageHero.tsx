import { Container, Eyebrow } from '@/components/ui';
import { Breadcrumbs, type Crumb } from '@/components/kc/Breadcrumbs';

/**
 * Reusable Academy page hero. One consistent masthead for every Academy page:
 * breadcrumb trail, eyebrow, display headline (with an optional signal-yellow
 * emphasis span), and a lead paragraph. Actions are passed in as children.
 */
export function PageHero({
  crumbs,
  eyebrow,
  title,
  highlight,
  intro,
  children,
}: {
  crumbs: Crumb[];
  eyebrow: string;
  title: string;
  /** Optional trailing phrase rendered in signal yellow after the title. */
  highlight?: string;
  intro?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-line bg-asphalt py-14 sm:py-20">
      <Container>
        <Breadcrumbs crumbs={crumbs} />
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="display-hero max-w-4xl text-5xl sm:text-6xl">
          {title} {highlight && <span className="text-signal">{highlight}</span>}
        </h1>
        {intro && <p className="mt-5 max-w-2xl text-lg text-muted">{intro}</p>}
        {children && (
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">{children}</div>
        )}
      </Container>
    </div>
  );
}
