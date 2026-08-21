import type { PublicFounder } from '@/lib/community/founders';
import { TIER_LABEL } from './tiers';

/**
 * A single founder on the wall. Business links render rel="sponsored nofollow"
 * to stay Google-compliant for paid placement. Individual dollar amounts are
 * deliberately not shown, and no aggregate money appears on any public surface
 * now that the school is funded — the wall is recognition, not a disclosure of
 * what anyone gave. Dark asphalt card with text-ink names, so the 2D wall stays
 * readable independently of the 3D plaque materials.
 */
export function FounderCard({ founder }: { founder: PublicFounder }) {
  const { display_name, business_name, business_url, tier, message } = founder;

  return (
    <div className="flex flex-col rounded-card border border-line bg-asphalt-800 p-5">
      <span className="mb-3 inline-flex w-fit items-center rounded-card border border-signal/40 bg-signal/10 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-signal">
        {TIER_LABEL[tier]}
      </span>
      <p className="font-display text-xl text-ink">{display_name}</p>
      {business_name && (
        <p className="mt-1 text-sm text-muted">
          {business_url ? (
            <a
              href={business_url}
              target="_blank"
              rel="sponsored nofollow noopener noreferrer"
              className="text-signal underline-offset-4 hover:underline"
            >
              {business_name}
            </a>
          ) : (
            business_name
          )}
        </p>
      )}
      {message && <p className="mt-3 text-sm text-muted">“{message}”</p>}
    </div>
  );
}
