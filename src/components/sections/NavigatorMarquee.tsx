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
 * icon dependency): phone-GPS visual language — a rounded-square app plate
 * with a route line taking one turn and a kite-shaped navigation arrow
 * heading up-and-right. Original TLWS art in the brand palette; it shares
 * its plate, corner radius, stroke weight and red-focal/amber-context
 * system with the parking tile's icon so the two read as one family.
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

          {/* GPS route + navigation arrow — single inline SVG, brand colors.
              App-style rounded plate, faint street grid, an amber route that
              takes one turn, and the red kite arrow pointing up-and-right. */}
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
            {/* faint map streets */}
            <path
              d="M3 18h42M30 3v14M14 32H3"
              stroke="#ffd66b"
              strokeOpacity="0.22"
              strokeWidth="1.5"
            />
            {/* route: start dot, straight leg, one turn, on toward the arrow */}
            <circle cx="13" cy="38" r="2.6" fill="#ffb020" />
            <path
              d="M13 38V27q0-5 5-5h7"
              fill="none"
              stroke="#ffb020"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M29 22h3.5"
              fill="none"
              stroke="#ffb020"
              strokeWidth="3"
              strokeLinecap="round"
              strokeOpacity="0.45"
            />
            {/* navigation arrow, up-and-right */}
            <g transform="translate(33.5 15.5) rotate(45)">
              <path
                d="M0 -8.5 L6.2 7 L0 3.4 L-6.2 7 Z"
                fill="#b3261e"
                stroke="#ffffff"
                strokeWidth="1.6"
                strokeLinejoin="round"
              />
            </g>
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
