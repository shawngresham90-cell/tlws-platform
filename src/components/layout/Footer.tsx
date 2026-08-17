import Link from 'next/link';
import { Container } from '@/components/ui';
import { SITE } from '@/lib/seo/site';
import { STORE_PRODUCTS } from '@/lib/store/products';

/**
 * Buying Guides and Shawn's Picks list Amazon products. While that catalog is
 * hidden (lib/store/visibility.ts) both pages render empty, so the footer stops
 * pointing at them rather than sending people to a dead end. They return the
 * moment the affiliate catalog is visible again.
 */
const AMAZON_VISIBLE = STORE_PRODUCTS.length > 0;

const COLUMNS: Array<{
  heading: string;
  links: Array<{ label: string; href: string; external?: boolean }>;
}> = [
  {
    heading: 'School',
    links: [
      { label: 'Academy', href: '/academy' },
      // Direct anchors to the academy sub-pages (SEO blueprint PR-C) —
      // sitewide inbound links so they stop being a closed crawl cluster.
      { label: 'Curriculum', href: '/academy/curriculum' },
      { label: 'Financing', href: '/academy/financing' },
      { label: 'Requirements', href: '/academy/requirements' },
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
      ...(AMAZON_VISIBLE
        ? [
            { label: 'Buying Guides', href: '/store/guides' },
            { label: "Shawn's Picks", href: '/store/shawns-picks' },
          ]
        : []),
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
          {/* rel="me" is the identity-verification token for the entity graph;
              it composes with (never replaces) the noopener/noreferrer every
              other outbound link on the site already carries. */}
          <div className="mt-4 flex gap-4 text-sm text-muted">
            <a
              href={SITE.social.youtube}
              className="hover:text-signal"
              target="_blank"
              rel="me noopener noreferrer"
            >
              YouTube
            </a>
            <a
              href={SITE.social.facebook}
              className="hover:text-signal"
              target="_blank"
              rel="me noopener noreferrer"
            >
              Facebook
            </a>
            <a
              href={SITE.social.tiktok}
              className="hover:text-signal"
              target="_blank"
              rel="me noopener noreferrer"
            >
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
        <p className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs">
          {/*
            Terms sits beside the other two because a Terms page nobody can
            find is a Terms page that does not do its job — and the signup
            checkbox now names it, so it has to be reachable from outside the
            Navigator as well as from inside it.
          */}
          <Link href="/terms" className="link-inline text-muted hover:text-signal">
            Terms of Service
          </Link>
          <Link href="/privacy" className="link-inline text-muted hover:text-signal">
            Privacy Policy
          </Link>
          <Link href="/sms-terms" className="link-inline text-muted hover:text-signal">
            SMS Terms &amp; Conditions
          </Link>
        </p>
      </Container>
    </footer>
  );
}
