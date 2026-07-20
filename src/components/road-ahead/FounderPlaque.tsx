'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  formatFounderNumber,
  isSafeExternalUrl,
  type WallFounder,
} from '@/lib/road-ahead/founder-number';
import type { FounderTier } from '@/lib/community/founders';
import { cueCarveTick, cueCarveFinish, soundOn } from './audio';
import styles from './road-ahead.module.css';

/**
 * One founder rendered as a real physical plaque — forged iron, brushed steel,
 * carved red-clay brick, or a premium brass sponsor plaque, per tier. As the
 * visitor scrolls the plaque into the centre band the "camera" pushes toward it
 * (translateZ) and the name is cut in letter-by-letter: each glyph drops into
 * its groove, kicks up material dust, and — when the visitor has enabled sound —
 * ticks a synchronized carve scrape, closing on a finish beat.
 *
 * Accessibility + integrity: the full name is always in the DOM (an sr-only copy
 * screen readers read immediately); the animated glyphs are decorative. No
 * contribution amount is ever shown. Under reduced motion (or no JS / no
 * IntersectionObserver) the name is simply already carved — static and readable,
 * no animation, no audio.
 */

type MaterialKey = 'iron' | 'steel' | 'brick' | 'sponsor' | 'paver';
type PlaqueSize = 'lg' | 'md' | 'sm';

const MATERIALS: Record<
  MaterialKey,
  {
    surface: string;
    carve: string;
    dust: string;
    sound: 'metal' | 'stone';
    /** tier-label colour that reads on this surface */
    label: string;
    /** business-link colour that reads on this surface */
    link: string;
  }
> = {
  iron: {
    surface: styles.matIron,
    carve: styles.carveMetalDark,
    dust: 'rgba(210,220,230,0.9)',
    sound: 'metal',
    label: 'text-white/70',
    link: 'text-white/80 hover:text-signal',
  },
  steel: {
    surface: styles.matSteel,
    carve: styles.carveMetalLight,
    dust: 'rgba(255,255,255,0.9)',
    sound: 'metal',
    label: 'text-black/55',
    link: 'text-black/65 hover:text-black',
  },
  brick: {
    surface: styles.matBrick,
    carve: styles.carveStone,
    dust: 'rgba(120,60,40,0.85)',
    sound: 'stone',
    label: 'text-white/60',
    link: 'text-white/75 hover:text-signal',
  },
  sponsor: {
    surface: styles.matSponsor,
    carve: styles.carveGold,
    dust: 'rgba(90,60,10,0.85)',
    sound: 'metal',
    label: 'text-black/60',
    link: 'text-black/70 hover:text-black',
  },
  paver: {
    surface: styles.matPaver,
    carve: styles.carvePaver,
    dust: 'rgba(180,180,175,0.85)',
    sound: 'stone',
    label: 'text-white/55',
    link: 'text-white/70 hover:text-signal',
  },
};

/** Which physical material a founder tier is rendered in. */
export function materialForTier(tier: FounderTier): MaterialKey {
  if (tier === 'equipment_sponsor' || tier === 'student_sponsor') return 'sponsor';
  if (tier === 'iron') return 'iron';
  if (tier === 'steel') return 'steel';
  if (tier === 'final_founder') return 'paver';
  return 'brick';
}

const CARVE_STEP_MS = 58;

const SIZE: Record<PlaqueSize, { pad: string; number: string; name: string; tier: string }> = {
  lg: {
    pad: 'px-8 py-7 sm:px-10 sm:py-9',
    number: 'text-3xl sm:text-4xl',
    name: 'text-2xl sm:text-4xl',
    tier: 'text-xs sm:text-sm',
  },
  md: {
    pad: 'px-5 py-5',
    number: 'text-2xl sm:text-3xl',
    name: 'text-lg sm:text-2xl',
    tier: 'text-[11px]',
  },
  sm: {
    pad: 'px-3 py-3',
    number: 'text-lg',
    name: 'text-sm sm:text-base',
    tier: 'text-[10px]',
  },
};

type Phase = 'pre' | 'go' | 'static';

export function FounderPlaque({
  founder,
  numberWidth,
  size,
  reduced,
}: {
  founder: WallFounder;
  numberWidth: number;
  size: PlaqueSize;
  reduced: boolean;
}) {
  const mat = MATERIALS[materialForTier(founder.tier)];
  const dims = SIZE[size];
  const name = founder.displayName;
  const glyphs = Array.from(name);

  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  const firstCb = useRef(true);
  const [phase, setPhase] = useState<Phase>(reduced ? 'static' : 'pre');
  const [focused, setFocused] = useState(false);
  const [settled, setSettled] = useState(false);

  // Reach detection: when the plaque enters the centre band, push the camera to
  // it and (once) start the carve. No IntersectionObserver → render it carved.
  useEffect(() => {
    if (reduced) {
      // JS pause / OS reduced-motion: drop straight to the static carved state
      // and clear any camera-push or pulse so no motion lingers.
      setPhase('static');
      setFocused(false);
      setSettled(false);
      return;
    }
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      setPhase('static');
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        setFocused(entry.isIntersecting);
        // If the plaque is already in the centre band on the very first callback
        // (e.g. a deep-link landing right on it), show it carved rather than
        // re-cutting an already-visible name. Carve only when it's scrolled INTO
        // the band.
        if (firstCb.current) {
          firstCb.current = false;
          if (entry.isIntersecting) {
            started.current = true;
            setPhase('static');
          }
          return;
        }
        if (entry.isIntersecting && !started.current) {
          started.current = true;
          setPhase('go');
        }
      },
      { rootMargin: '-30% 0px -30% 0px', threshold: 0 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [reduced]);

  // Carve audio + completion pulse, scheduled to match the CSS letter stagger.
  useEffect(() => {
    if (phase !== 'go') return;
    const total = glyphs.length * CARVE_STEP_MS;
    const timers: number[] = [];
    if (soundOn()) {
      glyphs.forEach((ch, i) => {
        if (ch.trim() === '') return; // no scrape on spaces
        timers.push(window.setTimeout(() => cueCarveTick(mat.sound, i), i * CARVE_STEP_MS));
      });
      timers.push(window.setTimeout(() => cueCarveFinish(mat.sound), total));
    }
    timers.push(window.setTimeout(() => setSettled(true), total + 60));
    timers.push(window.setTimeout(() => setSettled(false), total + 760));
    return () => timers.forEach((t) => window.clearTimeout(t));
    // glyphs is derived from name; depend on the stable name string.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, name, mat.sound]);

  const carveState =
    phase === 'static' ? styles.carveStatic : phase === 'go' ? styles.carveGo : styles.carvePre;

  const carveVars = {
    ['--n']: glyphs.length,
    ['--step']: `${CARVE_STEP_MS}ms`,
    ['--dust']: mat.dust,
  } as CSSProperties;

  return (
    <div
      ref={ref}
      className={cn(
        'relative isolate',
        styles.plaque,
        mat.surface,
        dims.pad,
        focused && styles.focused,
        settled && styles.settled,
      )}
    >
      {/* Content sits ABOVE the material texture/shine pseudo-layers so the
          carved lettering stays crisp (those layers paint over in-flow text). */}
      <div className="relative z-10">
        <p className={cn('font-display', styles.founderNumber, mat.carve, dims.number)}>
          {formatFounderNumber(founder.wallNumber, numberWidth)}
        </p>

        <p className={cn('mt-1 font-display uppercase leading-tight', mat.carve, dims.name)}>
          <span className="sr-only">{name}</span>
          <span className={cn(styles.carve, carveState)} style={carveVars} aria-hidden="true">
            <span className={styles.chisel} />
            {glyphs.map((ch, i) => (
              <span key={i} className={styles.glyph} style={{ ['--i']: i } as CSSProperties}>
                {ch}
              </span>
            ))}
          </span>
        </p>

        <p className={cn('mt-2 font-semibold uppercase tracking-wide', dims.tier, mat.label)}>
          {founder.tierLabel}
          {founder.contributions && founder.contributions > 1 ? (
            <span className={cn('ml-2', mat.link)}>· {founder.contributions} contributions</span>
          ) : null}
        </p>

        {founder.businessName ? (
          isSafeExternalUrl(founder.businessUrl) ? (
            <a
              href={founder.businessUrl ?? undefined}
              target="_blank"
              rel="sponsored nofollow noopener noreferrer"
              className={cn(
                'mt-2 inline-block text-xs underline-offset-2 hover:underline',
                mat.link,
              )}
            >
              {founder.businessName}
            </a>
          ) : (
            <p className={cn('mt-2 text-xs', mat.label)}>{founder.businessName}</p>
          )
        ) : null}
      </div>
    </div>
  );
}
