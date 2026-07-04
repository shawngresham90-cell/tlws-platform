import { cn } from '@/lib/utils/cn';

/** Consistent max-width + horizontal padding wrapper. */
export function Container({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn('mx-auto w-full max-w-content px-5 sm:px-8', className)}>{children}</div>
  );
}
