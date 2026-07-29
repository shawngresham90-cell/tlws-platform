import Link from 'next/link';
import { cn } from '@/lib/utils/cn';

/**
 * Truck Parking marquee tile — a premium, theater-marquee-style SQUARE
 * promotional button that sits directly beneath the shirt promo on the home
 * hero. The whole square links to the EXISTING /directory/parking page (no
 * duplicate page; every other parking entrance, including the mobile bottom
 * bar, is untouched).
 *
 * Built entirely from CSS + one inline SVG — no external or paid assets.
 * Marquee-bulb chase runs only on hover/tap/focus and only when the user
 * has not requested reduced motion (see globals.css). 48px+ target,
 * keyboard focusable with a strong visible ring, honest screen-reader
 * label, and no horizontal overflow at 320/375/390px (w-full, aspect-square
 * inside the same max-w-sm column as the shirt placard).
 */
export function TruckParkingMarquee({ className }: { className?: string }) {
  return (
    <Link
      href="/directory/parking"
      aria-label="Truck Parking — find a spot. Opens the truck parking directory."
      className={cn(
        'group/marquee relative block w-full max-w-sm select-none rounded-card',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-signal focus-visible:ring-offset-2 focus-visible:ring-offset-asphalt',
        'transition-transform motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.99]',
        className,
      )}
    >
      {/* Outer frame: black with the bulb ring in its padding gutter + glow. */}
      <div
        className="marquee-lights aspect-square w-full rounded-card border border-signal/70 bg-black p-[14px] shadow-[0_0_24px_rgba(255,176,32,0.28),0_10px_30px_rgba(0,0,0,0.6)]"
        aria-hidden="true"
      >
        {/* Inner panel: asphalt with a soft top spotlight and a faded road
            texture (dashed center line) — all CSS gradients. */}
        <div className="relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[10px] border-2 border-diesel/60 bg-asphalt [background-image:radial-gradient(ellipse_60%_45%_at_50%_0%,rgba(255,214,107,0.18),transparent_70%),repeating-linear-gradient(to_bottom,transparent_0px,transparent_26px,rgba(255,214,107,0.05)_26px,rgba(255,214,107,0.05)_30px)]">
          {/* Red accent rails, echoing the TLWS diesel stripe. */}
          <span className="absolute inset-x-6 top-2 h-[3px] rounded bg-diesel/80" />
          <span className="absolute inset-x-6 bottom-2 h-[3px] rounded bg-diesel/80" />

          {/* Semi-truck + P badge — single inline SVG, brand colors. */}
          <svg
            viewBox="0 0 96 44"
            className="mb-3 h-10 w-auto drop-shadow-[0_0_8px_rgba(255,176,32,0.45)] sm:h-12"
            role="img"
            aria-hidden="true"
            focusable="false"
          >
            {/* trailer */}
            <rect
              x="2"
              y="8"
              width="52"
              height="22"
              rx="2"
              fill="#1b1d21"
              stroke="#ffb020"
              strokeWidth="2"
            />
            {/* cab */}
            <path
              d="M56 12h14l10 9v9H56z"
              fill="#1b1d21"
              stroke="#ffb020"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            {/* wheels */}
            <circle cx="16" cy="34" r="6" fill="#0c0d0f" stroke="#ffb020" strokeWidth="2" />
            <circle cx="30" cy="34" r="6" fill="#0c0d0f" stroke="#ffb020" strokeWidth="2" />
            <circle cx="70" cy="34" r="6" fill="#0c0d0f" stroke="#ffb020" strokeWidth="2" />
            {/* P badge on the trailer */}
            <rect x="20" y="12" width="16" height="14" rx="2" fill="#b3261e" />
            <text
              x="28"
              y="23"
              textAnchor="middle"
              fontFamily="var(--font-anton), sans-serif"
              fontSize="11"
              fill="#ffffff"
            >
              P
            </text>
          </svg>

          <span className="text-center font-display text-3xl uppercase leading-none tracking-wide text-signal drop-shadow-[0_0_10px_rgba(255,176,32,0.55)] sm:text-4xl">
            Truck
            <br />
            Parking
          </span>
          <span className="mt-2 text-center text-xs font-bold uppercase tracking-[0.35em] text-ink">
            Find a spot
          </span>
          {/* Red accent chevron, subtle. */}
          <span
            aria-hidden="true"
            className="mt-2 font-display text-lg leading-none text-diesel-300"
          >
            ▸▸▸
          </span>
        </div>
      </div>
    </Link>
  );
}
