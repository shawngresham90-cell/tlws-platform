'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

/**
 * Sub-navigation for the directory admin tools (Milestone 21). Rendered at
 * the top of every /admin/directory* page so the growing toolset stays
 * discoverable. Keyboard/aria behavior matches AdminNav; admin auth is
 * enforced by each page's requireAdmin(), not here.
 */

const LINKS = [
  { href: '/admin/directory', label: 'Listings', exact: true },
  { href: '/admin/directory/import', label: 'Import' },
  { href: '/admin/directory/export', label: 'Export' },
  { href: '/admin/directory/geocoding', label: 'Geocoding' },
  { href: '/admin/directory/quality', label: 'Quality' },
  { href: '/admin/directory/corrections', label: 'Corrections' },
  { href: '/admin/directory/duplicates', label: 'Duplicates' },
  { href: '/admin/directory/tpc', label: 'Truck Parking Club' },
  { href: '/admin/directory/expansion', label: 'Expansion' },
  { href: '/admin/submissions', label: 'Submissions' },
  { href: '/admin/reviews', label: 'Reviews' },
];

export function DirectoryToolsNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Directory tools" className="mb-6 flex flex-wrap gap-1 border-b border-line pb-3">
      {LINKS.map((l) => {
        const active = l.exact ? pathname === l.href : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-card px-2.5 py-1 text-xs font-semibold transition-colors',
              active ? 'bg-signal text-asphalt' : 'text-muted hover:text-signal',
            )}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
