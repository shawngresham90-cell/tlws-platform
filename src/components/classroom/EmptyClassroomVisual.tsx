import Image from 'next/image';
import { cn } from '@/lib/utils/cn';

/**
 * The empty-classroom photograph for the "The Room Is Empty." state.
 *
 * Owner-supplied asset. It is rendered with the project's normal image
 * convention — next/image against a path under public/, explicit intrinsic
 * dimensions, and a `sizes` hint so the optimizer emits a candidate that
 * matches the rendered width instead of shipping the full-resolution file to
 * a phone.
 *
 * NOT CinematicStill. That component is the treatment for documentary
 * photography and applies a sodium colour grade, a bottom-third scrim and
 * `object-cover` cropping. All three would alter the supplied image, and the
 * brief asks for its natural aspect ratio, undegraded. So this is a plain
 * bordered figure: the frame is brand, the photograph is untouched.
 *
 * ASPECT RATIO. `h-auto w-full` means the browser lays the image out at its
 * OWN aspect ratio once decoded — ASSET_WIDTH/ASSET_HEIGHT only size the
 * placeholder box that reserves space beforehand. Getting them exactly right
 * costs nothing at render time but avoids a layout shift on first paint, so
 * they should match the real file's pixel dimensions.
 */

/** Where the owner-supplied photograph lives. */
export const EMPTY_CLASSROOM_SRC = '/images/classroom/empty-classroom.jpg';

/**
 * Intrinsic pixel dimensions of EMPTY_CLASSROOM_SRC — 4:3. Read from the
 * committed file, and pinned against it by the harness so the two can never
 * drift apart.
 */
export const ASSET_WIDTH = 1536;
export const ASSET_HEIGHT = 1152;

/** Alt text is fixed copy, not a prop — the brief specifies this wording. */
export const EMPTY_CLASSROOM_ALT = 'Empty classroom awaiting the next training session';

export function EmptyClassroomVisual({ className }: { className?: string }) {
  return (
    <figure className={cn('overflow-hidden rounded-card border-2 border-ink/15', className)}>
      <Image
        src={EMPTY_CLASSROOM_SRC}
        alt={EMPTY_CLASSROOM_ALT}
        width={ASSET_WIDTH}
        height={ASSET_HEIGHT}
        // Full bleed of the content column on phones and tablets; on desktop
        // the figure is capped at max-w-2xl, whose real rendered width is
        // 672px. Declaring that exactly means the optimizer picks a candidate
        // at least as wide as the box — the photograph is never upscaled, and
        // a 390px phone never downloads the full-resolution file.
        sizes="(min-width: 1024px) 672px, 100vw"
        className="h-auto w-full"
      />
    </figure>
  );
}
