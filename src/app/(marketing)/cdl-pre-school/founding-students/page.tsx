import Link from 'next/link';
import { Section, Eyebrow } from '@/components/ui';
import { PurchaseCta } from '@/components/preschool/PurchaseCta';
import { getFoundingWall } from '@/lib/preschool/data';
import {
  publicDisplayName,
  publicLinkFields,
  type PublicFoundingStudent,
} from '@/lib/preschool/founding-students';
import {
  CHECKOUT_DISCLOSURE,
  FOUNDING_CLAIM_PATH,
  FOUNDING_STUDENT_CAPACITY,
  FOUNDING_WALL_PATH,
  PRESCHOOL_PATH,
  PRESCHOOL_PRICE_LABEL,
} from '@/lib/preschool/constants';
import { JsonLd, breadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';

export const revalidate = 300;

export const metadata = buildMetadata({
  title: 'CDL Pre-School Founding Student Wall | Trucking Life with Shawn',
  description: `The first ${FOUNDING_STUDENT_CAPACITY} verified Founding Students of CDL Pre-School, recognized by name (or anonymously) on a permanent wall. Verified purchases only — no fabricated names, ever.`,
  path: FOUNDING_WALL_PATH,
});

function StudentCard({ student }: { student: PublicFoundingStudent }) {
  const { businessName, websiteUrl } = publicLinkFields(student);
  return (
    <li className="rounded-card border border-signal/40 bg-signal/10 p-5">
      {student.spotNumber != null && (
        <p className="text-xs font-semibold uppercase tracking-wide text-signal">
          Founding spot #{student.spotNumber}
        </p>
      )}
      <p className="mt-1 font-display text-lg uppercase text-ink">{publicDisplayName(student)}</p>
      {businessName && <p className="mt-1 text-sm text-muted">{businessName}</p>}
      {websiteUrl && (
        <p className="mt-2 text-sm">
          <a
            href={websiteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-signal underline-offset-4 hover:underline"
          >
            Visit website
          </a>
        </p>
      )}
    </li>
  );
}

export default async function FoundingStudentsPage() {
  const wall = await getFoundingWall();

  return (
    <>
      <JsonLd
        schema={breadcrumbSchema([
          { name: 'Home', path: '/' },
          { name: 'CDL Pre-School', path: PRESCHOOL_PATH },
          { name: 'Founding Students', path: FOUNDING_WALL_PATH },
        ])}
      />
      <Section className="border-b border-line">
        <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
          <Link href="/" className="hover:text-signal">
            Home
          </Link>{' '}
          <span aria-hidden="true">›</span>{' '}
          <Link href={PRESCHOOL_PATH} className="hover:text-signal">
            CDL Pre-School
          </Link>{' '}
          <span aria-hidden="true">›</span> <span className="text-ink">Founding Students</span>
        </nav>
        <Eyebrow>CDL Pre-School</Eyebrow>
        <h1 className="display-hero max-w-3xl">
          The Founding Student Wall<span className="text-signal">.</span>
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-muted">
          The first {FOUNDING_STUDENT_CAPACITY} verified Founding Students of CDL Pre-School,
          recognized permanently — by their chosen name, or anonymously. Every name here is a
          verified purchase. No placeholders, no fabricated spots.
        </p>
        <p className="mt-4 text-sm font-semibold uppercase tracking-wide text-signal">
          {wall.filled} of {FOUNDING_STUDENT_CAPACITY} spots filled · {wall.remaining} available
        </p>
      </Section>

      <Section className="border-b border-line bg-asphalt-800">
        {wall.students.length === 0 ? (
          <div className="mx-auto max-w-2xl rounded-card border border-line bg-asphalt p-8 text-center">
            <h2 className="font-display text-2xl uppercase text-ink">
              Founding Student spots are now available
            </h2>
            <p className="mt-3 text-muted">
              All {FOUNDING_STUDENT_CAPACITY} founding spots are open. The first{' '}
              {FOUNDING_STUDENT_CAPACITY} verified students take a permanent place on this wall.
            </p>
            <div className="mt-6 flex flex-col items-center gap-3">
              <PurchaseCta placement="wall-empty">
                Become a Founding Student — {PRESCHOOL_PRICE_LABEL}
              </PurchaseCta>
              <p className="max-w-md text-xs text-muted">{CHECKOUT_DISCLOSURE}</p>
            </div>
          </div>
        ) : (
          <>
            <h2 className="sr-only">Founding Students</h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {wall.students.map((s, i) => (
                <StudentCard key={`${s.spotNumber ?? 'x'}-${i}`} student={s} />
              ))}
            </ul>
            {wall.remaining > 0 && (
              <div className="mt-10 rounded-card border border-line bg-asphalt p-6 text-center">
                <p className="text-ink">
                  {wall.remaining} founding spot{wall.remaining === 1 ? '' : 's'} still open.
                </p>
                <div className="mt-4 flex flex-col items-center gap-3">
                  <PurchaseCta placement="wall">
                    Claim a Founding Student spot — {PRESCHOOL_PRICE_LABEL}
                  </PurchaseCta>
                  <p className="max-w-md text-xs text-muted">{CHECKOUT_DISCLOSURE}</p>
                </div>
              </div>
            )}
          </>
        )}
      </Section>

      <Section>
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-display text-xl uppercase text-ink">Already purchased?</h2>
          <p className="mt-2 text-sm text-muted">
            Submit your chosen public name and we&apos;ll verify your purchase by hand — nothing is
            published automatically.
          </p>
          <p className="mt-4">
            <Link
              href={FOUNDING_CLAIM_PATH}
              className="font-semibold text-signal underline-offset-4 hover:underline"
            >
              Claim your spot on the wall →
            </Link>
          </p>
        </div>
      </Section>
    </>
  );
}
