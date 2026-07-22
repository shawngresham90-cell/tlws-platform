import { cn } from '@/lib/utils/cn';

/**
 * Placard — the standard TLWS card (blueprint §2.4). Cab Panel surface,
 * hairline border, 8px radius. DOT-placard energy: information, framed.
 *
 * `money` adds the single platform-wide brand signature: a 2px Sodium Amber
 * left edge meaning "this card leads to money or action" (product, sponsor
 * slot, enrollment). Free/informational placards never set it, and no screen
 * should show more than two.
 */
export function Placard({
  money = false,
  padded = true,
  className,
  children,
  ...rest
}: {
  money?: boolean;
  /** p-6 (24px) desktop / p-4 (16px) mobile per the spacing system. */
  padded?: boolean;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('placard', money && 'placard-money', padded && 'p-4 sm:p-6', className)}
      {...rest}
    >
      {children}
    </div>
  );
}
