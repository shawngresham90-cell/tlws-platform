'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

const LINKS = [
  { href: '/admin', label: 'Overview' },
  { href: '/admin/directory', label: 'Directory' },
  { href: '/admin/submissions', label: 'Submissions' },
  { href: '/admin/reviews', label: 'Reviews' },
  { href: '/admin/applications', label: 'Applications' },
  { href: '/admin/founders', label: 'Founders' },
  { href: '/admin/cdl-preschool/founding-students', label: 'Pre-School' },
  { href: '/admin/store', label: 'Store' },
  { href: '/admin/sponsors', label: 'Sponsors' },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="flex flex-wrap gap-1">
      {LINKS.map((l) => {
        const active = l.href === '/admin' ? pathname === '/admin' : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-card px-3 py-1.5 text-sm font-semibold transition-colors',
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
