import Link from 'next/link';
import { Container } from '@/components/ui';
import { SITE } from '@/lib/seo/site';

const COLUMNS = [
  {
    heading: 'School',
    links: [
      { label: 'Academy', href: '/academy' },
      { label: 'Founders Wall', href: '/founders' },
    ],
  },
  {
    heading: 'Resources',
    links: [
      { label: 'Knowledge Center', href: '/knowledge' },
      { label: 'Truck Parking', href: '/directory/parking' },
    ],
  },
  {
    heading: 'More',
    links: [
      { label: 'Books', href: '/books' },
      { label: 'Apps', href: '/apps' },
      { label: 'Directories', href: '/directory' },
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
              {col.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-muted hover:text-signal">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </Container>
      <Container className="border-t border-line py-5">
        <p className="text-xs text-muted">
          © {new Date().getFullYear()} Trucking Life Academy LLC. Keep the shiny side up. 🚛
        </p>
      </Container>
    </footer>
  );
}
