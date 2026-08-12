import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils/cn';
import { PILOT_ACCESS_PATH } from '@/lib/navigator-api/pilot-access';

/**
 * Shared ICON PLATE geometry for the two hero feature tiles. Both cards mount
 * their artwork in this identical square: same size at each breakpoint, same
 * corner radius, same 2px signal border, same black ground, same centring and
 * the same `mb-3` gap to the header below. Declared here and imported by
 * TruckParkingMarquee so the two can never drift apart.
 */
export const TILE_ICON_PLATE =
  'flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-[22%] border-2 border-signal/70 bg-black sm:h-32 sm:w-32';

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
 * Icon is the OWNER-SUPPLIED Navigator artwork (approved 2026-08-12): the
 * blue-route turn-by-turn screen on a phone. It is mounted UNCROPPED and
 * undistorted inside TILE_ICON_PLATE — the square plate both hero tiles
 * share — so the two cards match on size, radius, border and spacing while
 * each keeps its own artwork at its true aspect. The source frame is 852×1846
 * (a tall phone), so `object-contain` inside a square plate is the only way to
 * be square-framed AND uncropped; the frame's black ground matches the
 * artwork's own black corners, so the letterboxing is invisible.
 *
 * No words live inside the image: the header and description below are real
 * text, so they scale, translate and read to a screen reader.
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
      aria-label="Open TLWS Navigator"
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

          {/* Owner's Navigator artwork, centred at the top of the card and
              mounted uncropped in the shared square plate. */}
          <div className={cn(TILE_ICON_PLATE, 'mb-3')}>
            <Image
              src="/images/home/tlws-navigator-icon.webp"
              alt=""
              width={852}
              height={1846}
              sizes="(min-width: 640px) 128px, 112px"
              className="h-full w-auto object-contain"
            />
          </div>

          <span className="text-center font-display text-3xl uppercase leading-none tracking-wide text-signal drop-shadow-[0_0_10px_rgba(255,176,32,0.55)] sm:text-4xl">
            TLWS Navigator
          </span>
          <span className="mt-2 text-center text-[11px] font-bold uppercase tracking-[0.18em] text-ink">
            Truck-safe GPS navigation
          </span>
        </div>
      </div>
    </Link>
  );
}
