'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Persistent mobile bottom bar — the three main driver tools one tap away
 * from every screen: Parking, Trip Planner, HOS. Fixed to the bottom on
 * small screens only (hidden at sm and up, where the header nav covers the
 * same destinations). The root layout adds matching bottom padding so the
 * bar never covers page content, and the bar itself pads for the device
 * safe area (home-indicator region) on notched phones.
 */

const TOOLS = [
  { href: '/directory/parking', label: 'Parking', icon: '🅿️' },
  { href: '/trip-planner', label: 'Trip Planner', icon: '🗺️' },
  { href: '/tools/hos-calculator', label: 'HOS', icon: '⏱️' },
] as const;

export function MobileToolBar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Driver tools"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-line bg-asphalt pb-[env(safe-area-inset-bottom)] sm:hidden"
    >
      <ul className="grid list-none grid-cols-3 p-0">
        {TOOLS.map(({ href, label, icon }) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[56px] flex-col items-center justify-center gap-0.5 px-1 py-2 text-center transition-colors ${
                  active ? 'text-signal' : 'text-muted hover:text-ink'
                }`}
              >
                <span aria-hidden="true" className="text-base leading-none">
                  {icon}
                </span>
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
