import type { ApprovedReview } from '@/lib/community/data';

/**
 * Server-rendered list of APPROVED driver reviews. The data layer only ever
 * hands this component approved rows — pending reviews have no render path.
 */

export function Stars({ rating }: { rating: number }) {
  return (
    <span aria-label={`${rating} out of 5 stars`} className="text-signal">
      {'★'.repeat(rating)}
      <span className="text-line">{'★'.repeat(5 - rating)}</span>
    </span>
  );
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    });
  } catch {
    return '';
  }
}

export function ReviewList({ reviews }: { reviews: ApprovedReview[] }) {
  if (reviews.length === 0) {
    return (
      <div className="rounded-card border border-line bg-asphalt-800 p-8 text-center">
        <p className="font-semibold text-ink">No reviews yet — be the first.</p>
        <p className="mt-2 text-sm text-muted">
          Approved reviews show up here. Yours could be the one that saves another driver a bad
          night.
        </p>
      </div>
    );
  }

  return (
    <ul className="grid gap-4">
      {reviews.map((r) => (
        <li key={r.id} className="rounded-card border border-line bg-asphalt-800 p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Stars rating={r.rating} />
            <span className="text-xs text-muted">{formatDate(r.createdAt)}</span>
          </div>
          <h3 className="mt-2 font-display text-lg uppercase text-ink">{r.title}</h3>
          <p className="mt-1 text-sm font-semibold text-signal">
            {r.location.name} — {r.location.city}, {r.location.state}
          </p>
          <p className="mt-3 whitespace-pre-line text-sm text-muted">{r.body}</p>
          <p className="mt-3 text-xs text-muted">
            {r.reviewerName ?? 'Verified driver submission'}
            {r.truckType ? ` · ${r.truckType}` : ''}
            {r.visitedOn ? ` · visited ${formatDate(r.visitedOn)}` : ''}
          </p>
        </li>
      ))}
    </ul>
  );
}
