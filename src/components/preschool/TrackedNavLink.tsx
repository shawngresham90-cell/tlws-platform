'use client';

import Link from 'next/link';
import { trackEvent } from '@/lib/analytics';
import { PRESCHOOL_EVENTS } from '@/lib/preschool/constants';

/**
 * Internal link that reports funnel movement (`preschool_nav_click` with
 * target path + placement only). Used for the non-purchase funnel steps:
 * homepage card → sales page, sales page → wall, wall → claim.
 */
export function TrackedNavLink({
  href,
  placement,
  className,
  children,
}: {
  href: string;
  placement: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={className}
      onClick={() => trackEvent(PRESCHOOL_EVENTS.navClick, { target: href, placement })}
    >
      {children}
    </Link>
  );
}
