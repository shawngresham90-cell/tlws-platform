import Link from 'next/link';
import { Container } from '@/components/ui';
import { SITE } from '@/lib/seo/site';

const COLUMNS: Array<{
  heading: string;
  links: Array<{ label: string; href: string; external?: boolean }>;
}> = [
  {
    heading: 'School',
    links: [
      { label: 'Academy', href: '/academy' },
      { label: 'CDL Pre-School', href: '/cdl-pre-school' },
      { label: 'Founding Students', href: '/cdl-pre-school/founding-students' },
      { label: 'Founders Wall', href: '/founders' },
      { label: 'Sponsors', href: '/sponsors' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'Knowledge Center', href: '/knowledge' },
      { label: 'DOT Guide', href: '/knowledge/dot-compliance' },
      { label: 'Practice Tests', href: '/practice-tests' },
      { label: 'Trip Planner', href: '/trip-planner' },
      { label: 'Truck Parking', href: '/directory/parking' },
    ],
  },
  {
    heading: 'More',
    links: [
      { label: 'Store', href: '/store' },
      { label: 'Buying Guides', href: '/store/guides' },
      { label: "Shawn's Picks", href: '/store/shawns-picks' },
      { label: 'Books', href: '/books' },
      { label: 'Apps', href: '/apps' },
      { label: 'Directories', href: '/directory' },
      { label: 'Videos', href: SITE.social.youtube, external: true },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-line bg-asphalt-800">
      <Container className="grid gap-10 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <p className="font-display text-xl uppercase text-ink">
            Trucking Life<span className="text-signal">.</span>
          </p>
          <p className="mt-2 max-w-xs text-sm text-muted">
            {SITE.tagline} CDL-A training in {SITE.city}, {SITE.region}, off I-75.
          </p>
          <div className="mt-4 flex gap-4 text-sm text-muted">
            <a href={SITE.social.youtube} className="hover:text-signal" rel="me">
              YouTube
            </a>
            <a href={SITE.social.facebook} className="hover:text-signal" rel="me">
              Facebook
            </a>
            <a href={SITE.social.tiktok} className="hover:text-signal" rel="me">
              TikTok
            </a>
          </div>
        </div>
        {COLUMNS.map((col) => (
          <nav key={col.heading} aria-label={col.heading}>
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-signal">
              {col.heading}
            </p>
            <ul className="space-y-2">
              {col.links.map((l) =>
                l.external ? (
                  <li key={l.href}>
                    <a
                      href={l.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm text-muted hover:text-signal"
                    >
                      {l.label}
                      <span className="sr-only"> (opens in new tab)</span>
                    </a>
                  </li>
                ) : (
                  <li key={l.href}>
                    <Link href={l.href} className="text-sm text-muted hover:text-signal">
                      {l.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </nav>
        ))}
      </Container>
      {/* Trust block (blueprint §4 S8) — real identity, real disclosures.
          Only verified facts render here; registration numbers are added by
          the owner when confirmed, never invented. */}
      <Container className="border-t border-line py-6">
        <p className="text-xs text-muted">
          © {new Date().getFullYear()} Trucking Life Academy LLC · {SITE.city}, {SITE.region} · off
          I-75 · Founded by {SITE.founder.name} — {SITE.founder.credential}.
        </p>
        <p className="mt-2 text-xs text-muted">
          As an Amazon Associate, Trucking Life earns from qualifying purchases made through store
          links. Sponsorship never changes directory rankings. Keep the shiny side up. 🚛
        </p>
      </Container>
    </footer>
  );
}
