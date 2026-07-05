'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Container } from '@/components/ui';
import { cn } from '@/lib/utils/cn';

/** Secondary navigation shared across every Academy page. */
const LINKS = [
  { label: 'Overview', href: '/academy' },
  { label: 'Curriculum', href: '/academy/curriculum' },
  { label: 'Requirements', href: '/academy/requirements' },
  { label: 'Financing', href: '/academy/financing' },
  { label: 'Facility', href: '/academy/facility' },
  { label: 'Instructors', href: '/academy/instructors' },
  { label: 'FAQ', href: '/academy/faq' },
];

/**
 * Sticky sub-nav for the Academy module. Horizontally scrollable on mobile so
 * every page stays one tap away without wrapping. Active state is derived from
 * the pathname (exact match for Overview, prefix match for the rest).
 */
export function AcademySubnav() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Academy"
      className="sticky top-16 z-40 border-b border-line bg-asphalt/95 backdrop-blur"
    >
      <Container>
        <ul className="-mx-1 flex gap-1 overflow-x-auto py-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {LINKS.map((l) => {
            const active =
              l.href === '/academy' ? pathname === '/academy' : pathname.startsWith(l.href);
            return (
              <li key={l.href} className="shrink-0">
                <Link
                  href={l.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'block whitespace-nowrap rounded-card px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition-colors',
                    active
                      ? 'bg-signal text-asphalt'
                      : 'text-muted hover:bg-asphalt-700 hover:text-signal',
                  )}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </Container>
    </nav>
  );
}
