'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { toolsFor, type ToolbarToolIcon } from './toolbar-tools';

/**
 * Persistent mobile bottom bar — the driver tools one tap away from every
 * screen. Fixed to the bottom on small screens only (hidden at sm and up,
 * where the header nav covers the same destinations). The root layout adds
 * matching bottom padding so the bar never covers page content, and the bar
 * itself pads for the device safe area (home-indicator region) on notched
 * phones. This bar owns bottom-0: anything else docking to the mobile
 * bottom edge (the CDL Pre-School sticky purchase bar) stacks ABOVE its
 * 56px band.
 *
 * Slots are contextual — resolved by `toolsFor` in ./toolbar-tools.ts.
 * Parking and Trip Planner are permanent; the third slot yields to the page
 * family's one next action (Academy → Apply, Knowledge → Pre-School). A
 * money slot rides amber TEXT — the same weight as the bar's existing
 * active state, never a filled amber bar — so the page's primary CTA keeps
 * the one-amber-element-per-viewport doctrine.
 *
 * Icons are inline 2px-stroke SVGs on currentColor (house rule: chrome
 * iconography is drawn, not typed — same as the parking marquee's rig).
 */

const ICONS: Record<ToolbarToolIcon, ReactNode> = {
  parking: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M9 17V7h4a3 3 0 0 1 0 6H9" />
    </svg>
  ),
  trip: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2Z" />
      <path d="M9 4v14" />
      <path d="M15 6v14" />
    </svg>
  ),
  hos: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  ),
  apply: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <rect x="8" y="2" width="8" height="4" rx="1" />
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <path d="m9 14 2 2 4-4" />
    </svg>
  ),
  preschool: (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-5 w-5"
      aria-hidden="true"
    >
      <path d="M12 7c-2-1.4-4.6-2-8-2v13c3.4 0 6 .6 8 2 2-1.4 4.6-2 8-2V5c-3.4 0-6 .6-8 2Z" />
      <path d="M12 7v13" />
    </svg>
  ),
};

export function MobileToolBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Driver tools"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-asphalt pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="grid list-none grid-cols-3 p-0">
        {toolsFor(pathname).map(({ href, label, icon, money }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 py-2 text-center transition-colors ${
                  active || money ? 'text-signal' : 'text-muted hover:text-ink'
                }`}
              >
                {ICONS[icon]}
                <span className="text-[11px] font-semibold uppercase tracking-wide leading-tight">
                  {label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
