import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { PILOT_ACCESS_PATH } from '@/lib/navigator-api/pilot-access';

/**
 * Navigator marquee tile — pilot access to the truck GPS Navigator, sitting
 * DIRECTLY BENEATH the Truck Parking tile in the hero promo column.
 *
 * Deliberately a near-copy of TruckParkingMarquee: same square aspect, same
 * max-w-sm column width, same marquee frame, bulb chase, focus ring, motion
 * treatment and type scale. The two tiles are siblings in one column, so any
 * divergence in size or spacing would read as a mistake rather than a
 * distinct feature. Only the icon, label and destination differ.
 *
 * Icon is an inline SVG like every other icon in this project (there is no
 * icon dependency): a compass ring with a navigation arrow — the map/heading
 * idiom the Navigator itself uses — drawn in the same brand palette as the
 * truck on the parking tile.
 *
 * ALWAYS RENDERS. Tile visibility is deliberately decoupled from
 * NEXT_PUBLIC_NAVIGATOR_ENABLED: the flag governs whether the Navigator
 * RUNTIME is live on a deploy, not whether the public may see that the pilot
 * exists. Drivers can find the pilot and ask for the password on production
 * while /drive, /navigator and the Navigator APIs stay shut.
 *
 * The destination is the PASSWORD GATE, not /drive. That is what makes an
 * always-visible tile safe: the gate is the one Navigator route with no flag
 * check and no token requirement, so this link can never land on a 404, and
 * it can never reach the Navigator itself without a correct password. An
 * already-unlocked driver is forwarded straight through by the gate.
 */
export function NavigatorMarquee({ className }: { className?: string }) {
  return (
    <Link
      href={PILOT_ACCESS_PATH}
      aria-label="Navigator — pilot access. Opens the truck GPS Navigator pilot."
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

          {/* Compass ring + heading arrow — single inline SVG, brand colors. */}
          <svg
            viewBox="0 0 48 48"
            className="mb-3 h-10 w-auto drop-shadow-[0_0_8px_rgba(255,176,32,0.45)] sm:h-12"
            role="img"
            aria-hidden="true"
            focusable="false"
          >
            {/* compass body */}
            <circle cx="24" cy="24" r="20" fill="#1b1d21" stroke="#ffb020" strokeWidth="2" />
            {/* cardinal ticks */}
            <path
              d="M24 5v4M24 39v4M5 24h4M39 24h4"
              stroke="#ffb020"
              strokeWidth="2"
              strokeLinecap="round"
            />
            {/* heading arrow — north half in diesel red, south half in asphalt */}
            <path d="M24 12l8 22-8-6z" fill="#b3261e" />
            <path d="M24 12l-8 22 8-6z" fill="#0c0d0f" stroke="#ffb020" strokeWidth="1.5" />
          </svg>

          <span className="text-center font-display text-3xl uppercase leading-none tracking-wide text-signal drop-shadow-[0_0_10px_rgba(255,176,32,0.55)] sm:text-4xl">
            Navigator
          </span>
          <span className="mt-2 text-center text-xs font-bold uppercase tracking-[0.35em] text-ink">
            Pilot access
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
