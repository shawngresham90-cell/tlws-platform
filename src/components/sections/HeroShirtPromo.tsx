import Image from 'next/image';
import { cn } from '@/lib/utils/cn';

/**
 * TEMPORARY launch merchandising placement (CDL School launch window).
 * A compact Steel & Sodium placard promoting the Founding Supporter shirt,
 * shown in the hero's upper-right on desktop and stacked below the hero
 * content on smaller screens. Reads as part of the placard system (Cab
 * Panel surface + one 2px sodium money-edge), never as a popup or ad.
 *
 * Isolated by design: no new dependencies, no data, no analytics. The
 * inventory count and the purchase link are the only things that change
 * when it sells out — flip REMOVE-ON-SELLOUT by deleting the one <HeroShirtPromo/>
 * usage in Hero.tsx. Reuses the existing Stan store link and shirt image
 * (same source as ShirtHero); the primary "Apply to the Academy" CTA stays
 * the dominant amber action in the hero.
 */

/** Existing Stan store purchase link (unchanged from ShirtHero). */
const SHIRT_URL = 'https://stan.store/TRUCKINGLIFEWITHSHAWN/p/founding-member-shirt--only-100-made';
/** Temporary launch inventory figure. Update as stock sells; remove at 0. */
const SHIRTS_LEFT = 65;

export function HeroShirtPromo({ className }: { className?: string }) {
  return (
    <aside
      aria-label={`Founding Supporter T-shirt — limited release, only ${SHIRTS_LEFT} left`}
      className={cn('placard placard-money w-full max-w-sm p-4 sm:p-5', className)}
    >
      <div className="flex items-center gap-4">
        <Image
          src="/images/store/founding-member-shirt.jpg"
          alt="Trucking Life Founding Supporter T-shirt"
          width={1086}
          height={1448}
          sizes="72px"
          className="h-24 w-[4.5rem] shrink-0 rounded-card object-cover"
        />
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-signal">
            Limited Release
          </p>
          <p className="mt-0.5 font-display text-base uppercase leading-tight text-ink">
            Founding Supporter T-Shirt
          </p>
          <p className="num-data mt-2 leading-none">
            <span className="font-display text-2xl uppercase text-signal">Only {SHIRTS_LEFT}</span>{' '}
            <span className="text-xs uppercase tracking-wide text-muted">shirts left</span>
          </p>
        </div>
      </div>
      <a
        href={SHIRT_URL}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-4 flex h-12 w-full items-center justify-center rounded-card bg-signal px-4 font-display text-sm uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt"
      >
        Get Yours
        <span className="sr-only"> — opens the store in a new tab</span>
      </a>
    </aside>
  );
}
