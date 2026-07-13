import { getSponsorsFor } from '@/lib/directory/sponsors-data';
import { SPONSOR_REL, type SponsorContext } from '@/lib/directory/sponsors';
import { TrackedCta } from './TrackedCta';

/**
 * A reusable, admin-configurable sponsor placement (Milestone 25). Async server
 * component: it fetches the active sponsors eligible for this placement/target
 * and renders them clearly labeled "Sponsored", with the required
 * rel="sponsored noopener noreferrer" on every outbound link. If there are no
 * eligible sponsors — including the normal case where migration 024 is
 * unapplied and the reader returns [] — it renders NOTHING (no empty box, no
 * layout shift). Placement is honest: the block is visibly a sponsor unit, set
 * apart from editorial listings, never dressed up as a ranked result.
 */
export async function SponsorSlot({
  className,
  ...ctx
}: SponsorContext & { className?: string }) {
  const sponsors = await getSponsorsFor(ctx);
  if (sponsors.length === 0) return null;

  return (
    <aside
      aria-label="Sponsored"
      className={`rounded-card border border-dashed border-line bg-asphalt-800/60 p-4 ${className ?? ''}`}
    >
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-muted">Sponsored</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {sponsors.map((s) => (
          <li key={s.id}>
            <TrackedCta
              event="sponsor_click"
              eventProps={{ placement: ctx.placement, sponsor: s.name }}
              href={s.url}
              target="_blank"
              rel={SPONSOR_REL}
              className="flex items-start gap-3 rounded-card border border-line bg-asphalt p-3 transition-colors hover:border-signal"
            >
              {s.logo && <span aria-hidden className="text-2xl leading-none">{s.logo}</span>}
              <span>
                <span className="block font-display text-sm uppercase text-ink">{s.name}</span>
                {s.tagline && <span className="mt-0.5 block text-xs text-muted">{s.tagline}</span>}
              </span>
            </TrackedCta>
          </li>
        ))}
      </ul>
    </aside>
  );
}
