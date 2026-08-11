import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

/**
 * Interstate guide-sign panel (Night Haul master blueprint §1.3) — the
 * wayfinding card for directory and navigation destinations, styled like the
 * green guide signage drivers read all day. Navigation semantics ONLY:
 * a sign panel is a road sign, not a status light (that's `marker`) and
 * never a money surface (that's amber). The face carries plain type like the
 * road does — no emoji, no icons required for meaning.
 *
 * Contrast, verified against the tokens: ink on `guide` ≈ 5.7:1 (AA); the
 * ink/85 description line still clears 4.5:1 on the panel fill.
 */
export function GuideSignCard({
  href,
  title,
  description,
  tab,
  cta,
  className,
}: {
  href: string;
  title: string;
  description?: string;
  /**
   * Optional exit-tab text riding the panel's top edge, e.g. "I-75" or
   * "Exit 320". Rendered inside the link, so it joins the accessible name —
   * real tab text only, never a fabricated exit number.
   */
  tab?: string;
  /** Optional short action line rendered like the sign's bottom legend. */
  cta?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'lift group relative block rounded-card border border-ink/35 bg-guide p-4 sm:p-5',
        'transition-colors hover:border-ink/70',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt',
        tab && 'mt-4',
        className,
      )}
    >
      {tab && (
        <span className="absolute -top-4 right-4 rounded-t-[4px] border border-b-0 border-ink/35 bg-guide-700 px-2 pb-1 pt-0.5 text-[10px] font-bold uppercase tracking-wider text-ink">
          {tab}
        </span>
      )}
      <span className="block font-display text-xl uppercase leading-tight text-ink sm:text-2xl">
        {title}
      </span>
      {description && <span className="mt-2 block text-sm text-ink/85">{description}</span>}
      {cta && (
        <span className="mt-3 block text-xs font-bold uppercase tracking-wider text-ink group-hover:underline group-hover:underline-offset-4">
          {cta} →
        </span>
      )}
    </Link>
  );
}
