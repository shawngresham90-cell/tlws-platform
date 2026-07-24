import Link from 'next/link';

/**
 * Business-facing conversion path from directory surfaces into the existing
 * sponsor inquiry pipeline. One quiet line — never dressed up as a listing,
 * never competing with driver-facing content, never in a safety-critical
 * control. No pricing, no promise of placement, traffic, leads, or ranking.
 *
 * It deep-links to the sponsor inquiry form with the interest preselected
 * (`interest=directory-placement`, an existing allowed option). The
 * originating surface rides along as a bounded `from` param for analytics
 * only — it is NOT persisted to the CRM (the sponsors table has no source
 * column; adding one is deferred, see docs). The inquiry form ignores it.
 */
function boundedSurface(surface?: string): string | null {
  if (!surface) return null;
  const slug = surface
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 32);
  return slug || null;
}

export function GetFeaturedCta({ surface, className }: { surface?: string; className?: string }) {
  const params = new URLSearchParams({ interest: 'directory-placement' });
  const from = boundedSurface(surface);
  if (from) params.set('from', from);
  return (
    <p className={`text-sm text-muted ${className ?? ''}`}>
      Run a truck stop, repair shop, or parking lot?{' '}
      <Link
        href={`/sponsors?${params.toString()}#inquire`}
        className="font-semibold text-signal hover:underline"
      >
        Get your business featured →
      </Link>
    </p>
  );
}
