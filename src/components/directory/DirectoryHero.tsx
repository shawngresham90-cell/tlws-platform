import { Container, Eyebrow } from '@/components/ui';
import { Breadcrumbs, type Crumb } from '@/components/kc/Breadcrumbs';

/**
 * Shared masthead for every directory page: breadcrumb trail, eyebrow,
 * headline, and intro. Keeps all directories reading as one system.
 */
export function DirectoryHero({
  crumbs,
  eyebrow,
  title,
  intro,
  children,
}: {
  crumbs: Crumb[];
  eyebrow: string;
  title: string;
  intro?: React.ReactNode;
  children?: React.ReactNode;
}) {
  return (
    <div className="border-b border-line bg-asphalt py-12 sm:py-16">
      <Container>
        <Breadcrumbs crumbs={crumbs} />
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className="display-section max-w-3xl">{title}</h1>
        {intro && <p className="mt-4 max-w-2xl text-muted">{intro}</p>}
        {children && <div className="mt-6 flex flex-col gap-3 sm:flex-row">{children}</div>}
      </Container>
    </div>
  );
}
