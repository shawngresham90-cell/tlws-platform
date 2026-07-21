import Image from 'next/image';
import Link from 'next/link';
import { Section, Button, Eyebrow } from '@/components/ui';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';
import { SITE } from '@/lib/seo/site';

export const metadata = buildMetadata({
  title: 'Books by Shawn Gresham — The Trucker Bookstore | Trucking Life with Shawn',
  description:
    'All six books by Shawn Gresham: The Trucker’s Carnivore Cookbook, The DOT Survival Guide, Defensive Driving For Truck Drivers, Discipline Over Everything, Broken But Built, and Meth Is the Devil’s Poison. Available on Amazon.',
  path: '/books',
  image: '/covers/truckers-carnivore-cookbook.jpg',
});

/** Amazon Associates tag. Applied to full amazon.com links (a.co short links already carry it). */
const AMZN_TAG = 'truckinglif0d-20';

type Book = {
  slug: string;
  title: string;
  badge?: string;
  description: string;
  whoFor: string;
  learn: string[];
  href: string;
  /** ISBN-13 when known — emitted in the Book schema for SEO. */
  isbn?: string;
  /** Path under /public — only set when the real cover exists. */
  cover?: { src: string; width: number; height: number };
};

const BOOKS: Book[] = [
  {
    slug: 'truckers-carnivore-cookbook',
    title: 'The Trucker’s Carnivore Cookbook',
    badge: 'Bestseller · 4.8★ on Amazon',
    description:
      '100 air-fryer meals you can cook right in the cab — real food that keeps you rolling. This is the book behind Shawn’s 93-pounds-down, diabetes-reversed story, written for drivers who are done letting truck-stop food run their health.',
    whoFor:
      'Drivers who want real energy and real health without leaving the truck — especially anyone tired of fast food, fighting their weight, or watching a DOT medical card slip away.',
    learn: [
      '100 carnivore meals built for an air fryer and a 12-volt cab',
      'How to shop, prep, and store meat on the road',
      'The exact eating approach behind 93 pounds lost from the driver’s seat',
    ],
    href: 'https://a.co/d/03cOB4V3',
    isbn: '9798284810675',
    cover: { src: '/covers/truckers-carnivore-cookbook.jpg', width: 297, height: 445 },
  },
  {
    slug: 'dot-survival-guide',
    title: 'The DOT Survival Guide',
    description:
      'Inspections, audits, and shutdowns — the playbook for staying legal when the DOT comes knocking. Written from 17 years of clean inspections, not from a lawyer’s desk.',
    whoFor:
      'Company drivers and owner-operators who want to stop fearing the scale house — and anyone who’s ever rolled past an inspection site holding their breath.',
    learn: [
      'How roadside inspections actually go down — and how to pass them',
      'What triggers audits and shutdowns, and how to stay off the radar',
      'The habits behind 17 years with zero violations',
    ],
    href: `https://www.amazon.com/DOT-Survival-Guide-Truckers-Shutdowns/dp/B0FDL26V8Q?tag=${AMZN_TAG}`,
    isbn: '9798288489280',
    cover: { src: '/covers/dot-survival-guide.jpg', width: 600, height: 899 },
  },
  {
    slug: 'defensive-driving-for-truck-drivers',
    title: 'Defensive Driving For Truck Drivers',
    description:
      'The habits, scanning patterns, and space-management rules that keep a big truck out of trouble — from a CDL instructor with 17 years and zero violations. Defensive driving is the skill that keeps every other part of this career alive.',
    whoFor:
      'New CDL holders building safe habits from day one, and veterans who want a sharp refresher on the discipline that keeps a record clean — because one preventable accident can undo years of work.',
    learn: [
      'Space management, scanning, and following-distance habits that prevent accidents',
      'How to handle four-wheelers, weather, work zones, and heavy traffic in a big truck',
      'The defensive mindset behind 17 years with zero violations',
    ],
    href: `https://www.amazon.com/Defensive-Driving-Truck-Drivers-Gresham/dp/B0FHQPQ3QR?tag=${AMZN_TAG}`,
    isbn: '9798292659631',
  },
  {
    slug: 'discipline-over-everything',
    title: 'Discipline Over Everything',
    description:
      'The truths nobody tells you. Road-tested discipline for drivers who want more out of this life than a paycheck — money, health, and a future you actually control.',
    whoFor:
      'Drivers grinding hard but going nowhere — anyone who knows the problem isn’t effort, it’s direction, and wants a straight-talk reset from someone who’s lived it.',
    learn: [
      'The discipline habits that compound on the road',
      'How to stop leaving money, health, and time on the table',
      'Building a life you don’t need a break from — from the driver’s seat',
    ],
    href: `https://www.amazon.com/Discipline-Over-Everything-Truths-Nobody/dp/B0FK3XQL5S?tag=${AMZN_TAG}`,
    cover: { src: '/covers/discipline-over-everything.jpg', width: 600, height: 899 },
  },
];

/**
 * Beyond the road — Shawn's faith, recovery, and rebuilding titles. Same
 * shelf treatment, separate section so the trucker bookstore stays focused.
 */
const LIFE_BOOKS: Book[] = [
  {
    slug: 'broken-but-built',
    title: 'Broken But Built',
    description:
      'A Christian man’s guide to healing after divorce, heartbreak, and betrayal. When life breaks you down, this is about letting God build you back — written straight, from a man who has lived the rebuilding.',
    whoFor:
      'Men walking through divorce, heartbreak, or betrayal who want a faith-grounded path forward — and anyone tired of pretending they’re fine when they’re not.',
    learn: [
      'Facing the wreckage honestly instead of numbing it',
      'A Christian framework for healing after divorce and betrayal',
      'Rebuilding identity, purpose, and strength one day at a time',
    ],
    href: `https://www.amazon.com/Broken-But-Built-Christian-Heartbreak/dp/B0FLPJ4PVM?tag=${AMZN_TAG}`,
    isbn: '9798296169419',
    cover: { src: '/covers/broken-but-built.jpg', width: 600, height: 899 },
  },
  {
    slug: 'meth-is-the-devils-poison',
    title: 'Meth Is the Devil’s Poison',
    description:
      'A true story of addiction, deliverance, and God’s power to save a soul from meth. No sugar-coating — what the poison takes, what it costs, and the way out.',
    whoFor:
      'Anyone fighting addiction, loving someone who is, or looking for proof that deliverance is real — told as a true story, not a lecture.',
    learn: [
      'What meth addiction actually does to a life, told first-hand',
      'The turning point from addiction to deliverance',
      'Faith, recovery, and staying free — one honest chapter at a time',
    ],
    href: `https://www.amazon.com/Meth-Devils-Poison-Addiction-Deliverance/dp/B0FW74VQNT?tag=${AMZN_TAG}`,
    cover: { src: '/covers/meth-is-the-devils-poison.jpg', width: 600, height: 899 },
  },
];

/** Every published book — schema, related links, and counts draw from this. */
const ALL_BOOKS: Book[] = [...BOOKS, ...LIFE_BOOKS];

/** Real cover when it exists; on-brand typographic cover until then (swap = one line). */
function BookCover({ book, featured = false }: { book: Book; featured?: boolean }) {
  const sizeClasses = featured ? 'w-56 sm:w-72' : 'w-48 sm:w-56';
  if (book.cover) {
    return (
      <Image
        src={book.cover.src}
        alt={`${book.title} — book cover`}
        width={book.cover.width}
        height={book.cover.height}
        priority={featured}
        className={`${sizeClasses} h-auto rounded-card border border-line shadow-xl`}
      />
    );
  }
  return (
    <div
      aria-label={`${book.title} — book cover`}
      className={`${sizeClasses} flex aspect-[2/3] flex-col justify-between rounded-card border border-line bg-gradient-to-b from-asphalt-700 to-asphalt p-5 shadow-xl`}
    >
      <span className="font-display text-2xl uppercase leading-tight text-signal">
        {book.title}
      </span>
      <span className="text-[10px] font-semibold uppercase tracking-widest text-muted">
        Trucking Life with Shawn
      </span>
    </div>
  );
}

function ReviewsBlock({ book }: { book: Book }) {
  return (
    <div className="mt-8 rounded-card border border-line bg-asphalt-800 p-5">
      <h3 className="font-display text-base uppercase text-ink">Driver reviews</h3>
      <p className="mt-2 text-sm text-muted">
        Reviews from drivers land here soon. Read what truckers are saying right now on{' '}
        <a
          href={book.href}
          target="_blank"
          rel="noopener sponsored"
          className="font-semibold text-signal hover:underline"
        >
          Amazon →
        </a>
      </p>
    </div>
  );
}

function RelatedBooks({ current }: { current: Book }) {
  const related = ALL_BOOKS.filter((b) => b.slug !== current.slug);
  return (
    <div className="mt-6">
      <h3 className="text-xs font-semibold uppercase tracking-widest text-muted">
        Related books
      </h3>
      <div className="mt-2 flex flex-wrap gap-2">
        {related.map((b) => (
          <Link
            key={b.slug}
            href={`#${b.slug}`}
            className="rounded-card border border-line px-3 py-1.5 text-sm font-semibold text-ink transition-colors hover:border-signal hover:text-signal"
          >
            {b.title} →
          </Link>
        ))}
      </div>
    </div>
  );
}

function BookShelf({ book, featured = false }: { book: Book; featured?: boolean }) {
  return (
    <article
      id={book.slug}
      className="grid scroll-mt-24 items-start gap-8 lg:grid-cols-[auto,1fr] lg:gap-12"
    >
      <div className="justify-self-center lg:justify-self-start">
        <BookCover book={book} featured={featured} />
      </div>
      <div>
        {book.badge && (
          <span className="mb-3 inline-block rounded-card bg-signal px-2 py-0.5 font-body text-xs font-bold uppercase tracking-wide text-asphalt">
            {book.badge}
          </span>
        )}
        <h2 className={featured ? 'display-section' : 'font-display text-3xl uppercase text-ink'}>
          {book.title}
        </h2>
        <p className="mt-4 max-w-2xl text-muted">{book.description}</p>

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div className="rounded-card border border-line p-5">
            <h3 className="font-display text-base uppercase text-signal">Who this book is for</h3>
            <p className="mt-2 text-sm text-muted">{book.whoFor}</p>
          </div>
          <div className="rounded-card border border-line p-5">
            <h3 className="font-display text-base uppercase text-signal">What you’ll learn</h3>
            <ul className="mt-2 space-y-1.5">
              {book.learn.map((item) => (
                <li key={item} className="flex gap-2 text-sm text-ink">
                  <span aria-hidden="true" className="text-signal">
                    ✓
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="mt-7">
          <Button href={book.href}>Buy on Amazon</Button>
        </div>

        <ReviewsBlock book={book} />
        <RelatedBooks current={book} />
      </div>
    </article>
  );
}

function bookSchema(book: Book) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Book',
    name: book.title,
    author: { '@type': 'Person', name: SITE.founder.name },
    url: `${SITE.url}/books#${book.slug}`,
    ...(book.cover ? { image: `${SITE.url}${book.cover.src}` } : {}),
    ...(book.isbn ? { isbn: book.isbn } : {}),
    bookFormat: 'https://schema.org/Paperback',
    inLanguage: 'en',
    audience: { '@type': 'Audience', audienceType: 'Truck drivers' },
  };
}

export default function BooksPage() {
  const [featured, ...rest] = BOOKS;
  return (
    <>
      <JsonLd
        schema={[
          breadcrumbSchema([
            { name: 'Home', path: '/' },
            { name: 'Books', path: '/books' },
          ]),
          {
            '@context': 'https://schema.org',
            '@type': 'ItemList',
            name: 'Books by Shawn Gresham',
            itemListElement: ALL_BOOKS.map((b, i) => ({
              '@type': 'ListItem',
              position: i + 1,
              item: bookSchema(b),
            })),
          },
        ]}
      />

      {/* Store header + featured book */}
      <Section className="border-b border-line">
        <div className="max-w-2xl">
          <Eyebrow>The Trucker Bookstore</Eyebrow>
          <h1 className="display-section">Driver-built books</h1>
          <p className="mt-4 text-muted">
            Written by a driver, for drivers — 17 years on the road, zero violations. No fluff,
            just the stuff that keeps you legal, healthy, and earning.
          </p>
        </div>
        <div className="mt-12">
          <BookShelf book={featured} featured />
        </div>
      </Section>

      {/* Rest of the shelf */}
      {rest.map((book, i) => (
        <Section
          key={book.slug}
          className={`border-b border-line ${i % 2 === 0 ? 'bg-asphalt-800' : ''}`}
        >
          <BookShelf book={book} />
        </Section>
      ))}

      {/* Beyond the road — faith, recovery, and rebuilding */}
      <Section className="border-b border-line">
        <div className="max-w-2xl">
          <Eyebrow>Beyond the Road</Eyebrow>
          <h2 className="display-section">Faith, recovery &amp; rebuilding</h2>
          <p className="mt-4 text-muted">
            The road teaches more than driving. These books are Shawn’s story off the
            highway — faith, healing, and getting back up.
          </p>
        </div>
      </Section>
      {LIFE_BOOKS.map((book, i) => (
        <Section
          key={book.slug}
          className={`border-b border-line ${i % 2 === (rest.length % 2) ? 'bg-asphalt-800' : ''}`}
        >
          <BookShelf book={book} />
        </Section>
      ))}

      <Section className="border-b border-line">
        <p className="text-xs text-muted">
          As an Amazon Associate, purchases through these links may earn a commission — at no extra
          cost to you.
        </p>
        <div className="mt-8 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-w-xl">
            <h2 className="display-section">Want the PDFs &amp; tools?</h2>
            <p className="mt-3 text-muted">
              The DOT Survival System bundle, free CDL guides, and driver tools live on the Apps
              &amp; PDFs page.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button href="/apps">Browse Apps &amp; PDFs</Button>
            <Button
              variant="ghost"
              href="https://stan.store/TRUCKINGLIFEWITHSHAWN"
              className="whitespace-nowrap"
            >
              Visit the Stan Store
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
