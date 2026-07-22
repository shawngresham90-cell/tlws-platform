import { Container, Eyebrow } from '@/components/ui';
import { cn } from '@/lib/utils/cn';
import { Breadcrumbs, type Crumb } from '@/components/kc/Breadcrumbs';

/**
 * Reusable Academy page hero. One consistent masthead for every Academy page:
 * breadcrumb trail, eyebrow, display headline (with an optional signal-yellow
 * emphasis span), and a lead paragraph. Actions are passed in as children.
 *
 * `cinematic` opts a page into the restrained documentary atmosphere (sodium
 * light wash + film grain) — used on the school landing page only. Forms,
 * FAQ, and utility pages stay plain by rule.
 */
export function PageHero({
  crumbs,
  eyebrow,
  title,
  highlight,
  intro,
  cinematic,
  children,
}: {
  crumbs: Crumb[];
  eyebrow: string;
  title: string;
  /** Optional trailing phrase rendered in signal yellow after the title. */
  highlight?: string;
  intro?: React.ReactNode;
  /** Documentary atmosphere — school-front-door surfaces only. */
  cinematic?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        'border-b border-line bg-asphalt py-14 sm:py-20',
        cinematic && 'relative overflow-hidden',
      )}
    >
      {cinematic && (
        <>
          {/* Above the masthead bg, below the relative content — negative
              z-index would hide these behind the masthead's own background. */}
          <div
            aria-hidden="true"
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(110% 90% at 82% -10%, rgba(245,166,35,0.09) 0%, rgba(245,166,35,0) 55%), linear-gradient(180deg, #1A1A1C 0%, #141414 72%)',
            }}
          />
          <div aria-hidden="true" className="film-grain absolute inset-0" />
        </>
      )}
      <Container className={cinematic ? 'relative' : undefined}>
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
