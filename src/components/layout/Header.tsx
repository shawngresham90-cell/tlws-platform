import Link from 'next/link';
import { Container } from '@/components/ui';
import { HeaderMenu } from './HeaderMenu';

/**
 * Navigation discipline (blueprint §2.9): six top-level destinations, one
 * Apply CTA, everything else nests in the grouped menu. Every entry must
 * resolve to a live route — a dead nav link never ships.
 */
const PRIMARY_NAV = [
  { label: 'The Road Ahead', href: '/road-ahead' },
  { label: 'Academy', href: '/academy' },
  { label: 'CDL Pre-School', href: '/cdl-pre-school' },
  { label: 'Knowledge Center', href: '/knowledge' },
  { label: 'Practice Tests', href: '/practice-tests' },
  { label: 'Directory', href: '/directory' },
];

/** Grouped full map — the disclosure menu on every viewport. */
const MENU_GROUPS: Array<{
  heading: string;
  links: Array<{ label: string; href: string }>;
}> = [
  {
    heading: 'School',
    links: [
      { label: 'Academy', href: '/academy' },
      { label: 'Apply', href: '/academy/apply' },
      { label: 'CDL Pre-School', href: '/cdl-pre-school' },
      { label: 'Founders Wall', href: '/founders' },
      { label: 'Sponsors', href: '/sponsors' },
    ],
  },
  {
    heading: 'Learn',
    links: [
      { label: 'Knowledge Center', href: '/knowledge' },
      { label: 'DOT Guide', href: '/knowledge/dot-compliance' },
      { label: 'Practice Tests', href: '/practice-tests' },
    ],
  },
  {
    heading: 'Drive',
    links: [
      { label: 'Directory', href: '/directory' },
      { label: 'Truck Parking', href: '/directory/parking' },
      { label: 'Trip Planner', href: '/trip-planner' },
    ],
  },
  {
    heading: 'More',
    links: [
      { label: 'The Road Ahead', href: '/road-ahead' },
      { label: 'DOT Tools', href: '/dot-tools' },
      { label: 'Store', href: '/store' },
      { label: 'Books', href: '/books' },
      { label: 'Apps', href: '/apps' },
    ],
  },
];

/**
 * Mobile-first header. Uses a native <details> disclosure for the menu —
 * zero JavaScript, fully keyboard-accessible, works with JS disabled. The
 * same grouped menu serves as desktop overflow ("More") and mobile nav.
 */
export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-asphalt/95 backdrop-blur">
      <Container className="flex h-16 items-center justify-between gap-4">
        <Link
          href="/"
          className="shrink-0 font-display text-xl uppercase tracking-tight text-ink sm:text-2xl"
        >
          Trucking Life<span className="text-signal">.</span>
        </Link>

        {/* Desktop nav — six destinations, nothing else */}
        <nav aria-label="Primary" className="hidden items-center gap-5 xl:flex">
          {PRIMARY_NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-xs font-semibold uppercase tracking-wide text-muted transition-colors hover:text-signal"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="/academy/apply"
            className="hidden shrink-0 rounded-card bg-signal px-4 py-2 font-display text-sm uppercase text-asphalt transition-colors hover:bg-signal-600 sm:inline-block"
          >
            Apply
          </Link>

          {/* Grouped menu — CSS disclosure + client shell for route-change
              close and Escape. Accessible name matches the visible label
              ("More" on desktop, "Menu" where only the icon shows). */}
          <HeaderMenu>
            <summary className="flex h-12 cursor-pointer list-none items-center justify-center gap-2 rounded-card border border-line px-3 text-ink transition-colors hover:border-signal [&::-webkit-details-marker]:hidden">
              <span className="sr-only xl:hidden">Menu</span>
              <span className="hidden text-xs font-semibold uppercase tracking-wide xl:inline">
                More
              </span>
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden="true"
              >
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            </summary>
            <nav
              aria-label="All pages"
              className="absolute right-0 top-12 max-h-[calc(100vh-5rem)] w-64 overflow-y-auto rounded-card border border-line bg-cab p-3 shadow-xl"
            >
              {MENU_GROUPS.map((group) => (
                <div key={group.heading} className="mb-2 last:mb-0">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wider text-signal">
                    {group.heading}
                  </p>
                  {group.links.map((item) => (
                    <Link
                      key={`${group.heading}-${item.href}`}
                      href={item.href}
                      className="block rounded-card px-3 py-3 text-sm font-semibold uppercase tracking-wide text-muted transition-colors hover:bg-asphalt-600 hover:text-signal"
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              ))}
            </nav>
          </HeaderMenu>
        </div>
      </Container>
    </header>
  );
}
