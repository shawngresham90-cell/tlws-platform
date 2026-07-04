import Link from 'next/link';
import { Container } from '@/components/ui';

/** Footer shell. "Keep the shiny side up." stays — it's the brand signoff. */
export function Footer() {
  return (
    <footer className="border-t border-line bg-asphalt-800">
      <Container className="flex flex-col gap-4 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-lg uppercase text-ink">
            Trucking Life<span className="text-signal">.</span>
          </p>
          <p className="mt-1 text-sm text-muted">Drivers helping drivers. Dalton, GA · off I-75.</p>
        </div>
        <div className="flex gap-6 text-sm text-muted">
          <Link href="/academy" className="hover:text-signal">
            Academy
          </Link>
          <Link href="/founders" className="hover:text-signal">
            Founders Wall
          </Link>
          <Link href="/sponsors" className="hover:text-signal">
            Sponsors
          </Link>
        </div>
      </Container>
      <Container className="border-t border-line py-4">
        <p className="text-xs text-muted">
          © {new Date().getFullYear()} Trucking Life Academy LLC. Keep the shiny side up. 🚛
        </p>
      </Container>
    </footer>
  );
}
