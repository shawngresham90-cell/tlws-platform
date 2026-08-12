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

          {/* Parking sign + tractor-trailer silhouette — single inline SVG,
              brand colors. Same app-style plate, corner radius, stroke weight
              and red-focal/amber-context system as the Navigator tile's icon,
              so the pair reads as one family. Original TLWS art — no other
              company's mark. */}
          <svg
            viewBox="0 0 48 48"
            className="mb-3 h-14 w-auto drop-shadow-[0_0_8px_rgba(255,176,32,0.45)] sm:h-16"
            role="img"
            aria-hidden="true"
            focusable="false"
          >
            {/* app plate */}
            <rect
              x="3"
              y="3"
              width="42"
              height="42"
              rx="11"
              fill="#1b1d21"
              stroke="#ffb020"
              strokeWidth="2"
            />
            {/* parking sign: red badge, white P drawn as a path (no font) */}
            <rect
              x="9"
              y="8"
              width="17"
              height="16"
              rx="3.5"
              fill="#b3261e"
              stroke="#ffffff"
              strokeWidth="1.6"
            />
            <path
              d="M14.5 20.5v-9h4.2a2.9 2.9 0 0 1 0 5.8h-4.2"
              fill="none"
              stroke="#ffffff"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {/* tractor-trailer silhouette, nose right */}
            <rect x="6" y="27" width="23" height="10.5" rx="1" fill="#ffb020" />
            <path d="M30.5 37.5v-8.5h4.5l3.2-4h3l1.8 5v7.5z" fill="#ffb020" />
            <circle cx="12" cy="38.5" r="3" fill="#1b1d21" stroke="#ffb020" strokeWidth="2" />
            <circle cx="19.5" cy="38.5" r="3" fill="#1b1d21" stroke="#ffb020" strokeWidth="2" />
            <circle cx="37" cy="38.5" r="3" fill="#1b1d21" stroke="#ffb020" strokeWidth="2" />
            {/* ground line — pairs with the Navigator icon's route line */}
            <path
              d="M5 42.5h38"
              stroke="#ffb020"
              strokeOpacity="0.5"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
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
