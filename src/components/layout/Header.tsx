import Link from 'next/link';
import { Container } from '@/components/ui';

/** Full nav map. Links are placeholders until each module ships. */
const NAV = [
  { label: 'Academy', href: '/academy' },
  { label: 'CDL Pre-School', href: '/cdl-pre-school' },
  { label: 'Knowledge Center', href: '/knowledge' },
  { label: 'DOT Guide', href: '/dot-guide' },
  { label: 'Practice Tests', href: '/practice-tests' },
  { label: 'Truck Parking', href: '/directory/parking' },
  { label: 'Directories', href: '/directory' },
  { label: 'Store', href: '/store' },
  { label: 'Books', href: '/books' },
  { label: 'Apps', href: '/apps' },
  { label: 'Sponsors', href: '/sponsors' },
  { label: 'Founders Wall', href: '/founders' },
  { label: 'Contact', href: '/contact' },
];

/**
 * Mobile-first header. Uses a native <details> disclosure for the mobile menu —
 * zero JavaScript, fully keyboard-accessible, works with JS disabled.
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

        {/* Desktop nav */}
        <nav aria-label="Primary" className="hidden items-center gap-5 xl:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-xs font-semibold uppercase tracking-wide text-muted transition-colors hover:text-signal"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <Link
          href="/academy"
          className="hidden shrink-0 rounded-card bg-signal px-4 py-2 font-display text-sm uppercase text-asphalt transition-colors hover:bg-signal-600 sm:inline-block"
        >
          Apply
        </Link>

        {/* Mobile menu — pure CSS disclosure */}
        <details className="relative xl:hidden">
          <summary
            className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-card border border-line text-ink [&::-webkit-details-marker]:hidden"
            aria-label="Open menu"
          >
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
            aria-label="Mobile"
            className="absolute right-0 top-12 w-60 rounded-card border border-line bg-asphalt-800 p-2 shadow-xl"
          >
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="block rounded-card px-3 py-2 text-sm font-semibold uppercase tracking-wide text-muted transition-colors hover:bg-asphalt-700 hover:text-signal"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </details>
      </Container>
    </header>
  );
}
