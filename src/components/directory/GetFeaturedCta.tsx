import Link from 'next/link';

/**
 * Business-facing conversion path from directory surfaces into the sponsor
 * inquiry pipeline. One quiet line — never dressed up as a listing, never
 * competing with driver-facing content. The `context` string rides along so
 * the inquiry records which surface produced it (e.g. "I-75", "truck-stops").
 */
export function GetFeaturedCta({ context, className }: { context?: string; className?: string }) {
  const qs = new URLSearchParams({ interest: 'directory-placement' });
  if (context) qs.set('context', context.slice(0, 40));
  return (
    <p className={`text-sm text-muted ${className ?? ''}`}>
      Run a truck stop, repair shop, or parking lot?{' '}
      <Link
        href={`/sponsors?${qs.toString()}#inquire`}
        className="font-semibold text-signal hover:underline"
      >
        Get your business featured →
      </Link>
    </p>
  );
}
