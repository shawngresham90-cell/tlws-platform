import Link from 'next/link';
import { Container } from '@/components/ui';

const NAV = [
  { label: 'Academy', href: '/academy' },
  { label: 'Founders Wall', href: '/founders' },
  { label: 'Sponsors', href: '/sponsors' },
  { label: 'Practice Test', href: '/practice-test' },
];

/** Navigation shell. Placeholder links — feature pages land in later milestones. */
export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-line bg-asphalt/95 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Link href="/" className="font-display text-2xl uppercase tracking-tight text-ink">
          Trucking Life<span className="text-signal">.</span>
        </Link>
        <nav aria-label="Primary" className="hidden items-center gap-7 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-sm font-semibold uppercase tracking-wide text-muted transition-colors hover:text-signal"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/academy"
          className="rounded-card bg-signal px-4 py-2 font-display text-sm uppercase text-asphalt transition-colors hover:bg-signal-600"
        >
          Enroll
        </Link>
      </Container>
    </header>
  );
}
