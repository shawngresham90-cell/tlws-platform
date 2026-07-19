'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Founders Movement — placeholder 3D wall (POC).
 *
 * CSS-3D stand-in for the production `FoundersWall3D` (R3F, instanced tiles +
 * SDF names — docs/founders-movement-experience.md §4/§12). Demonstrates the
 * interaction contract the canvas version must honor:
 *  - tiles are real DOM buttons (keyboard + screen-reader parity for free);
 *  - tier ⇒ material treatment (the five real DB tiers);
 *  - scroll-triggered reveal with stagger, skipped under reduced motion;
 *  - selecting a tile opens a focus-managed story dialog.
 *
 * SAMPLE DATA ONLY: the POC deliberately renders placeholder names, not
 * production founder records — the live wall stays at /founders. Production
 * wires `getPublicFounders()` into the identical `tiles` shape.
 */

type Tier = 'equipment_sponsor' | 'student_sponsor' | 'iron' | 'steel' | 'brick';

type SampleTile = { name: string; tier: Tier; story: string };

const TIER_STYLE: Record<Tier, { label: string; surface: string; edge: string }> = {
  equipment_sponsor: {
    label: 'Equipment Sponsor',
    surface: 'bg-gradient-to-br from-zinc-200 via-zinc-400 to-zinc-300 text-asphalt',
    edge: 'border-zinc-100/70',
  },
  student_sponsor: {
    label: 'Student Sponsor',
    surface: 'bg-gradient-to-br from-amber-700 via-amber-500 to-amber-600 text-asphalt',
    edge: 'border-amber-300/70',
  },
  iron: {
    label: 'Iron Founder',
    surface: 'bg-gradient-to-br from-neutral-800 via-neutral-700 to-neutral-900 text-ink',
    edge: 'border-neutral-500/60',
  },
  steel: {
    label: 'Steel Founder',
    surface: 'bg-gradient-to-br from-slate-500 via-slate-400 to-slate-600 text-asphalt',
    edge: 'border-slate-200/60',
  },
  brick: {
    label: 'Brick Founder',
    surface: 'bg-gradient-to-br from-red-900 via-red-800 to-orange-950 text-ink',
    edge: 'border-red-400/40',
  },
};

const SAMPLE_TILES: SampleTile[] = [
  { name: 'Sample Sponsor Co.', tier: 'equipment_sponsor', story: 'Funded a training tractor.' },
  { name: 'A. Student Sponsor', tier: 'student_sponsor', story: 'Put a driver in the seat.' },
  { name: 'Iron Sample One', tier: 'iron', story: 'A cornerstone contribution.' },
  { name: 'Iron Sample Two', tier: 'iron', story: 'Backed the build early.' },
  { name: 'Steel Sample One', tier: 'steel', story: 'A major boost to the build.' },
  { name: 'Steel Sample Two', tier: 'steel', story: 'Name high on the wall.' },
  { name: 'Steel Sample Three', tier: 'steel', story: 'Drivers helping drivers.' },
  { name: 'Brick Sample One', tier: 'brick', story: 'Laid a brick in the foundation.' },
  { name: 'Brick Sample Two', tier: 'brick', story: 'Every founder counts.' },
  { name: 'Brick Sample Three', tier: 'brick', story: 'Part of the foundation.' },
  { name: 'Brick Sample Four', tier: 'brick', story: 'Building the school.' },
  { name: 'Brick Sample Five', tier: 'brick', story: 'For the next generation.' },
];

export function WallScene() {
  const [revealed, setRevealed] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [selected, setSelected] = useState<SampleTile | null>(null);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const lastTriggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => {
      setReduced(mq.matches);
      if (mq.matches) setRevealed(true);
    };
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  // Scroll-triggered reveal (single fire) — the canvas twin listens to the
  // same trigger in production so DOM and 3D stay in lockstep.
  useEffect(() => {
    if (revealed || !rootRef.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setRevealed(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(rootRef.current);
    return () => io.disconnect();
  }, [revealed]);

  const close = useCallback(() => {
    setSelected(null);
    lastTriggerRef.current?.focus();
  }, []);

  // Dialog focus management: focus in on open, Esc closes, focus returns.
  useEffect(() => {
    if (!selected) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, close]);

  return (
    <div ref={rootRef}>
      <p className="mb-6 text-xs font-semibold uppercase tracking-widest text-muted">
        Prototype wall — placeholder names. The real founders are on the{' '}
        <a
          href="/founders"
          className="underline decoration-signal underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
        >
          Founders Wall
        </a>
        .
      </p>

      {/* Perspective container: the "3D" of the placeholder wall. */}
      <div style={{ perspective: '1400px' }}>
        <ul
          className="grid list-none grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          style={reduced ? undefined : { transform: 'rotateX(4deg) rotateY(-6deg)' }}
        >
          {SAMPLE_TILES.map((tile, i) => {
            const t = TIER_STYLE[tile.tier];
            return (
              <li key={tile.name}>
                <button
                  type="button"
                  onClick={(e) => {
                    lastTriggerRef.current = e.currentTarget;
                    setSelected(tile);
                  }}
                  className={`group block w-full rounded-card border ${t.edge} ${t.surface} p-4 text-left shadow-lg transition-all duration-500 hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal ${
                    revealed ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
                  }`}
                  style={reduced ? undefined : { transitionDelay: `${i * 60}ms` }}
                >
                  <span className="block font-display text-sm uppercase tracking-[0.12em] [text-shadow:0_1px_0_rgba(255,255,255,0.15),0_-1px_1px_rgba(0,0,0,0.5)]">
                    {tile.name}
                  </span>
                  <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wider opacity-70">
                    {t.label}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Founder story panel — same dialog the 3D picking layer will open. */}
      {selected && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-4 sm:items-center"
          onClick={close}
          role="presentation"
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={`Founder story: ${selected.name}`}
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-card border border-line bg-asphalt-800 p-6 shadow-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
          >
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
              {TIER_STYLE[selected.tier].label} · sample story
            </p>
            <h3 className="mt-1 font-display text-2xl uppercase text-white">{selected.name}</h3>
            <p className="mt-3 text-sm text-muted">{selected.story}</p>
            <button
              type="button"
              onClick={close}
              className="mt-6 rounded-card border border-line px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
