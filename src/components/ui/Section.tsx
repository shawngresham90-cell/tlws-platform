import { cn } from '@/lib/utils/cn';
import { Container } from './Container';

/**
 * Vertical rhythm wrapper. Single job: consistent section spacing.
 * Forwards the aria landmark props: ShirtHero has passed aria-labelledby
 * since the cinematic pass and JSX silently dropped it here, leaving the
 * section unlabeled — hyphenated attributes bypass excess-prop checks.
 */
export function Section({
  className,
  children,
  id,
  'aria-labelledby': ariaLabelledby,
  'aria-label': ariaLabel,
}: {
  className?: string;
  children: React.ReactNode;
  id?: string;
  'aria-labelledby'?: string;
  'aria-label'?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={ariaLabelledby}
      aria-label={ariaLabel}
      className={cn('py-16 sm:py-24', className)}
    >
      <Container>{children}</Container>
    </section>
  );
}
