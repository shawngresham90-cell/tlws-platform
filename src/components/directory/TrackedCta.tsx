'use client';

import type { AnchorHTMLAttributes, ReactNode } from 'react';
import { trackEvent, hostOf, type AnalyticsEvent, type AnalyticsProps } from '@/lib/analytics';

/**
 * An outbound CTA link that emits a client-side analytics event on click
 * (dataLayer + `tlws:analytics` CustomEvent — see lib/analytics.ts). Renders
 * a plain anchor; tracking never delays or blocks navigation. Use for every
 * affiliate and sponsor link so click-through is measurable the moment an
 * analytics tool is connected.
 */
export function TrackedCta({
  event,
  eventProps,
  href,
  children,
  ...rest
}: {
  event: AnalyticsEvent;
  eventProps?: AnalyticsProps;
  href: string;
  children: ReactNode;
} & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return (
    <a
      href={href}
      {...rest}
      onClick={() => trackEvent(event, { link_domain: hostOf(href), ...eventProps })}
    >
      {children}
    </a>
  );
}
