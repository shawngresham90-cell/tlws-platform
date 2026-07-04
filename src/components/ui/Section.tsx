import { cn } from '@/lib/utils/cn';
import { Container } from './Container';

/** Vertical rhythm wrapper. Single job: consistent section spacing. */
export function Section({
  className,
  children,
  id,
}: {
  className?: string;
  children: React.ReactNode;
  id?: string;
}) {
  return (
    <section id={id} className={cn('py-16 sm:py-24', className)}>
      <Container>{children}</Container>
    </section>
  );
}
