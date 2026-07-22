import Image from 'next/image';
import { cn } from '@/lib/utils/cn';

/**
 * Cinematic still — the reusable treatment for REAL photography
 * (docs/design/cinematic-photography-guide.md). Warm sodium grade, a
 * bottom-third scrim that keeps caption text readable on any frame, film
 * grain, and a documentary caption whose every word must be verified.
 *
 * House rules encoded here:
 * - real photographs only — no stock people, no AI-generated people;
 * - alt text is required (enforced by the prop type);
 * - the grade never drops caption contrast below readable (scrim ≥ .78 at
 *   the baseline where text sits);
 * - decorative layers are aria-hidden and pointer-transparent.
 */
export function CinematicStill({
  src,
  alt,
  width,
  height,
  sizes,
  caption,
  label,
  priority,
  className,
  imgClassName,
}: {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes?: string;
  /** Documentary caption rendered in the bottom third. Verified copy only. */
  caption?: string;
  /** Short amber lead-in before the caption, e.g. a source credit. */
  label?: string;
  priority?: boolean;
  className?: string;
  imgClassName?: string;
}) {
  return (
    <figure className={cn('relative overflow-hidden rounded-card border border-line', className)}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        sizes={sizes}
        priority={priority}
        className={cn('h-full w-full object-cover', imgClassName)}
      />
      {/* Sodium grade + bottom-third readability scrim */}
      <div
        aria-hidden="true"
        className="absolute inset-0"
        style={{
          background:
            'linear-gradient(180deg, rgba(20,20,20,0.10) 0%, rgba(20,20,20,0) 40%, rgba(20,20,20,0.88) 100%), linear-gradient(0deg, rgba(245,166,35,0.07), rgba(245,166,35,0.07))',
        }}
      />
      <div aria-hidden="true" className="film-grain absolute inset-0" />
      {caption && (
        // Explicit utilities, not .doc-caption: that class carries text-muted,
        // which would win the cascade and fail contrast over bright frames.
        <figcaption className="absolute inset-x-0 bottom-0 p-4 text-[11px] font-semibold uppercase tracking-wider text-ink/90">
          {label && <span className="text-signal">{label} · </span>}
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
