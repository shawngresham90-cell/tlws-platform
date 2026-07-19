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

export function WallScene({ founderCount = 0 }: { founderCount?: number }) {
  const [revealed, setRevealed] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [selected, setSelected] = useState<SampleTile | 'empty' | null>(null);
  // Empty Tile preview state — never stored, never sent anywhere.
  const [previewName, setPreviewName] = useState('');
  const [previewTier, setPreviewTier] = useState<Tier>('brick');
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
      <div className="relative overflow-hidden" style={{ perspective: '1400px' }}>
        {/* FM-2: one-time raking-light sweep across the wall on reveal —
            low sun catching engraved names edge-first. Skipped under
            reduced motion; plays exactly once (fill: forwards). */}
        {revealed && !reduced && (
          <div
            aria-hidden="true"
            data-testid="fm-wall-sweep"
            className="fm-wall-sweep pointer-events-none absolute inset-y-0 z-10 w-1/3"
            style={{
              background:
                'linear-gradient(105deg, transparent 0%, rgba(255,235,150,0.14) 45%, rgba(255,235,150,0.05) 55%, transparent 100%)',
            }}
          />
        )}
        <style>{`
          @keyframes fm-wall-sweep-move {
            from { transform: translateX(-120%); }
            to { transform: translateX(420%); }
          }
          .fm-wall-sweep {
            animation: fm-wall-sweep-move 1.6s cubic-bezier(0.3, 0.6, 0.4, 1) 0.35s both;
          }
          @media (prefers-reduced-motion: reduce) {
            .fm-wall-sweep { animation: none; opacity: 0; }
          }
        `}</style>
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
          {/* The Empty Tile — the one that isn't taken. */}
          <li>
            <button
              type="button"
              onClick={(e) => {
                lastTriggerRef.current = e.currentTarget;
                setSelected('empty');
              }}
              className={`block w-full rounded-card border border-dashed border-signal/60 bg-asphalt-800/80 p-4 text-left shadow-lg transition-all duration-500 hover:-translate-y-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal ${
                revealed ? 'translate-y-0 opacity-100' : 'translate-y-6 opacity-0'
              }`}
              style={reduced ? undefined : { transitionDelay: `${SAMPLE_TILES.length * 60}ms` }}
            >
              <span className="block font-display text-sm uppercase tracking-[0.12em] text-signal">
                This one isn&apos;t taken.
              </span>
              <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wider text-muted">
                See your name on it
              </span>
            </button>
          </li>
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
            aria-label={
              selected === 'empty' ? 'See your name on the wall' : `Founder story: ${selected.name}`
            }
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-card border border-line bg-asphalt-800 p-6 shadow-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
          >
            {selected === 'empty' ? (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                  The founding generation
                </p>
                <h3 className="mt-1 font-display text-2xl uppercase text-white">
                  See your name on it
                </h3>
                <label htmlFor="fm-preview-name" className="mt-4 block text-sm text-muted">
                  Type your name — preview only, nothing is saved or sent.
                </label>
                <input
                  id="fm-preview-name"
                  type="text"
                  maxLength={40}
                  autoComplete="off"
                  value={previewName}
                  onChange={(e) => setPreviewName(e.target.value)}
                  placeholder="Your name"
                  className="mt-2 w-full rounded-card border border-line bg-asphalt px-3 py-2 text-white placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
                />
                <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Choose a tier">
                  {(Object.keys(TIER_STYLE) as Tier[]).map((t) => (
                    <button
                      key={t}
                      type="button"
                      aria-pressed={previewTier === t}
                      onClick={() => setPreviewTier(t)}
                      className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal ${
                        previewTier === t
                          ? 'border-signal text-signal'
                          : 'border-line text-muted hover:border-signal/60'
                      }`}
                    >
                      {TIER_STYLE[t].label}
                    </button>
                  ))}
                </div>
                {/* The engraved preview tile. */}
                <div
                  className={`mt-4 rounded-card border ${TIER_STYLE[previewTier].edge} ${TIER_STYLE[previewTier].surface} p-5`}
                >
                  <span className="block font-display text-lg uppercase tracking-[0.14em] [text-shadow:0_1px_0_rgba(255,255,255,0.2),0_-1px_2px_rgba(0,0,0,0.65)]">
                    {previewName.trim() || 'Your Name'}
                  </span>
                  <span className="mt-1 block text-[10px] font-semibold uppercase tracking-wider opacity-75">
                    {TIER_STYLE[previewTier].label} · Founder #{founderCount + 1}
                  </span>
                </div>
                <p className="mt-3 text-xs text-muted">
                  Founder numbers are permanent — once the school opens, the founding generation is
                  closed.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <a
                    href="/founders#join"
                    className="rounded-card bg-signal px-5 py-2.5 text-sm font-semibold text-asphalt transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
                  >
                    Take your place on the wall
                  </a>
                  <button
                    type="button"
                    onClick={close}
                    className="rounded-card border border-line px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
                  >
                    Close
                  </button>
                </div>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
