'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { cueEngrave, duckForReveal } from './audio';
import { setPreviewIdentity } from './identity';

/**
 * FM-3 wall: real founders + The Induction.
 *
 * The wall renders the REAL founding generation (public rows only, same data
 * as /founders) with the canonical chronological founder number — №N is the
 * Nth person who said yes, ever, across all tiers. When no founders can be
 * loaded (empty table or failed fetch) it falls back to clearly-labeled
 * sample tiles so the page never breaks.
 *
 * The Induction is the page's decision moment, staged as ceremony, not
 * celebration: the visitor types their name, the screen dims, the raking
 * light passes over THEIR tile once, and three lines settle in slowly —
 * FOUNDER №N · FOUNDED <year> · THE FOUNDING GENERATION. If sound is on,
 * everything ducks to near-silence for the reveal. ~10 seconds, skippable
 * with any click, fully static under prefers-reduced-motion. Nothing is
 * stored or sent; the preview lives in memory only (see identity.ts) —
 * permanence is what joining is for.
 */

type Tier = 'equipment_sponsor' | 'student_sponsor' | 'iron' | 'steel' | 'brick';

export type WallFounder = {
  name: string;
  tier: Tier;
  /** Canonical chronological number across ALL tiers (earliest paid_at = №1). */
  number: number;
  year: number;
  message: string | null;
};

const TIER_STYLE: Record<
  Tier,
  { label: string; surface: string; edge: string; card: [string, string] }
> = {
  equipment_sponsor: {
    label: 'Equipment Sponsor',
    surface: 'bg-gradient-to-br from-zinc-200 via-zinc-400 to-zinc-300 text-asphalt',
    edge: 'border-zinc-100/70',
    card: ['#d8d8dc', '#9a9aa2'],
  },
  student_sponsor: {
    label: 'Student Sponsor',
    surface: 'bg-gradient-to-br from-amber-700 via-amber-500 to-amber-600 text-asphalt',
    edge: 'border-amber-300/70',
    card: ['#b45309', '#f59e0b'],
  },
  iron: {
    label: 'Iron Founder',
    surface: 'bg-gradient-to-br from-neutral-800 via-neutral-700 to-neutral-900 text-ink',
    edge: 'border-neutral-500/60',
    card: ['#262626', '#404040'],
  },
  steel: {
    label: 'Steel Founder',
    surface: 'bg-gradient-to-br from-slate-500 via-slate-400 to-slate-600 text-asphalt',
    edge: 'border-slate-200/60',
    card: ['#64748b', '#94a3b8'],
  },
  brick: {
    label: 'Brick Founder',
    surface: 'bg-gradient-to-br from-red-900 via-red-800 to-orange-950 text-ink',
    edge: 'border-red-400/40',
    card: ['#7f1d1d', '#9a3412'],
  },
};

/** Fallback tiles when no live founders load — clearly labeled as samples. */
const SAMPLE_TILES: WallFounder[] = [
  { name: 'Sample Sponsor Co.', tier: 'equipment_sponsor', number: 0, year: 2026, message: null },
  { name: 'A. Student Sponsor', tier: 'student_sponsor', number: 0, year: 2026, message: null },
  { name: 'Iron Sample One', tier: 'iron', number: 0, year: 2026, message: null },
  { name: 'Steel Sample One', tier: 'steel', number: 0, year: 2026, message: null },
  { name: 'Steel Sample Two', tier: 'steel', number: 0, year: 2026, message: null },
  { name: 'Brick Sample One', tier: 'brick', number: 0, year: 2026, message: null },
  { name: 'Brick Sample Two', tier: 'brick', number: 0, year: 2026, message: null },
  { name: 'Brick Sample Three', tier: 'brick', number: 0, year: 2026, message: null },
];

function drawFounderCard(name: string, number: number, tier: Tier): void {
  const [c1, c2] = TIER_STYLE[tier].card;
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 675;
  const g = canvas.getContext('2d');
  if (!g) return;
  g.fillStyle = '#0e0e0e';
  g.fillRect(0, 0, 1200, 675);
  const grad = g.createLinearGradient(0, 240, 1200, 430);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  g.fillStyle = grad;
  g.fillRect(80, 240, 1040, 190);
  g.strokeStyle = 'rgba(255,255,255,0.25)';
  g.lineWidth = 2;
  g.strokeRect(80, 240, 1040, 190);
  g.fillStyle = '#ffeb00';
  g.font = 'bold 30px sans-serif';
  g.textAlign = 'center';
  g.fillText('THE FOUNDING GENERATION', 600, 160);
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.font = '22px sans-serif';
  g.fillText('TRUCKING LIFE', 600, 200);
  g.fillStyle = tier === 'iron' || tier === 'brick' ? '#f5f5f5' : '#0e0e0e';
  g.font = 'bold 64px sans-serif';
  g.fillText(name.toUpperCase().slice(0, 26), 600, 348);
  g.font = 'bold 30px sans-serif';
  g.fillText(`FOUNDER №${number} · ${TIER_STYLE[tier].label.toUpperCase()}`, 600, 400);
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.font = '24px sans-serif';
  g.fillText(`FOUNDED ${new Date().getFullYear()} · I WAS HERE WHEN IT BEGAN.`, 600, 500);
  g.fillStyle = 'rgba(255,255,255,0.4)';
  g.font = '20px sans-serif';
  g.fillText('truckinglifewithshawn.com/founders', 600, 610);
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = `founder-${number}-card.png`;
  a.click();
}

export function WallScene({
  founders = [],
  nextNumber = 1,
}: {
  founders?: WallFounder[];
  nextNumber?: number;
}) {
  const live = founders.length > 0;
  const tiles = live ? founders : SAMPLE_TILES;
  const [revealed, setRevealed] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [selected, setSelected] = useState<WallFounder | 'empty' | null>(null);
  // Induction state — preview only, never stored or sent.
  const [previewName, setPreviewName] = useState('');
  const [previewTier, setPreviewTier] = useState<Tier>('brick');
  const [stage, setStage] = useState<'input' | 'ceremony'>('input');
  const [skipped, setSkipped] = useState(false);
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
    setStage('input');
    setSkipped(false);
    lastTriggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!selected) return;
    dialogRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, close]);

  const beginCeremony = () => {
    const name = previewName.trim();
    if (!name) return;
    setPreviewIdentity({ name, number: nextNumber, tierLabel: TIER_STYLE[previewTier].label });
    cueEngrave();
    duckForReveal(3200);
    setSkipped(false);
    setStage('ceremony');
  };

  const instant = reduced || skipped; // ceremony renders fully settled

  return (
    <div ref={rootRef}>
      <p className="mb-6 text-xs font-semibold uppercase tracking-widest text-muted">
        {live ? (
          <>The founding generation — live from the wall, in the order they said yes.</>
        ) : (
          <>
            Placeholder names shown. The real founders are on the{' '}
            <a
              href="/founders"
              className="underline decoration-signal underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
            >
              Founders Wall
            </a>
            .
          </>
        )}
      </p>

      {/* Perspective container: the "3D" of the placeholder wall. */}
      <div className="relative overflow-hidden" style={{ perspective: '1400px' }}>
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
          @keyframes fm-ind-in {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .fm-ind { opacity: 0; animation: fm-ind-in 0.9s ease-out both; }
          .fm-ind-now { opacity: 1; animation: none; }
          @media (prefers-reduced-motion: reduce) {
            .fm-wall-sweep { animation: none; opacity: 0; }
            .fm-ind { animation: none; opacity: 1; transform: none; }
          }
        `}</style>
        <ul
          className="grid list-none grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
          style={reduced ? undefined : { transform: 'rotateX(4deg) rotateY(-6deg)' }}
        >
          {tiles.map((tile, i) => {
            const t = TIER_STYLE[tile.tier];
            return (
              <li key={`${tile.name}-${i}`}>
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
                    {live ? `№ ${tile.number} · ${t.label} · Founded ${tile.year}` : t.label}
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
              style={reduced ? undefined : { transitionDelay: `${tiles.length * 60}ms` }}
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

      {/* Founder story panel / the Induction. */}
      {selected && (
        <div
          className={`fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center ${
            selected === 'empty' && stage === 'ceremony' ? 'bg-black/95' : 'bg-black/70'
          }`}
          onClick={() => {
            // Mid-ceremony, a stray click skips to the settled state instead
            // of destroying the moment; anywhere else it closes.
            if (selected === 'empty' && stage === 'ceremony' && !skipped) setSkipped(true);
            else close();
          }}
          role="presentation"
        >
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={
              selected === 'empty'
                ? stage === 'ceremony'
                  ? 'Your place on the wall'
                  : 'See your name on the wall'
                : `Founder: ${selected.name}`
            }
            tabIndex={-1}
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-md rounded-card border p-6 shadow-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal ${
              selected === 'empty' && stage === 'ceremony'
                ? 'border-signal/30 bg-asphalt'
                : 'border-line bg-asphalt-800'
            }`}
          >
            {selected === 'empty' ? (
              stage === 'input' ? (
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
                  <div
                    className="mt-3 flex flex-wrap gap-2"
                    role="group"
                    aria-label="Choose a tier"
                  >
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
                  <div className="mt-5 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={beginCeremony}
                      disabled={!previewName.trim()}
                      className="rounded-card bg-signal px-5 py-2.5 text-sm font-semibold text-asphalt transition-transform hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
                    >
                      See it on the wall
                    </button>
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
                /* ── The Induction — ceremony, not celebration. ─────────── */
                <div aria-live="polite">
                  <div
                    className={`relative overflow-hidden rounded-card border ${TIER_STYLE[previewTier].edge} ${TIER_STYLE[previewTier].surface} p-6 ${instant ? 'fm-ind-now' : 'fm-ind'}`}
                    style={instant ? undefined : { animationDelay: '0.2s' }}
                  >
                    {!instant && (
                      <div
                        aria-hidden="true"
                        className="fm-wall-sweep pointer-events-none absolute inset-y-0 w-1/2"
                        style={{
                          background:
                            'linear-gradient(105deg, transparent 0%, rgba(255,235,150,0.22) 45%, transparent 100%)',
                          animationDelay: '0.9s',
                        }}
                      />
                    )}
                    <span className="block font-display text-2xl uppercase tracking-[0.14em] [text-shadow:0_1px_0_rgba(255,255,255,0.2),0_-1px_2px_rgba(0,0,0,0.65)]">
                      {previewName.trim()}
                    </span>
                  </div>
                  <div className="mt-5 space-y-2 text-center">
                    <p
                      className={`font-display text-xl uppercase tracking-[0.2em] text-signal ${instant ? 'fm-ind-now' : 'fm-ind'}`}
                      style={instant ? undefined : { animationDelay: '1.9s' }}
                    >
                      Founder №{nextNumber}
                    </p>
                    <p
                      className={`text-xs font-semibold uppercase tracking-[0.3em] text-ink ${instant ? 'fm-ind-now' : 'fm-ind'}`}
                      style={instant ? undefined : { animationDelay: '2.7s' }}
                    >
                      Founded {new Date().getFullYear()}
                    </p>
                    <p
                      className={`text-xs font-semibold uppercase tracking-[0.3em] text-muted ${instant ? 'fm-ind-now' : 'fm-ind'}`}
                      style={instant ? undefined : { animationDelay: '3.5s' }}
                    >
                      The founding generation
                    </p>
                  </div>
                  <div
                    className={`mt-6 ${instant ? 'fm-ind-now' : 'fm-ind'}`}
                    style={instant ? undefined : { animationDelay: '5.4s' }}
                  >
                    <p className="text-center text-sm text-muted">
                      This place on the wall isn&apos;t taken. It could be.
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-3">
                      <a
                        href="/founders#join"
                        className="rounded-card bg-signal px-5 py-2.5 text-sm font-semibold text-asphalt transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
                      >
                        Take your place on the wall
                      </a>
                      <button
                        type="button"
                        onClick={() => drawFounderCard(previewName.trim(), nextNumber, previewTier)}
                        className="rounded-card border border-line px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
                      >
                        Download your Founder Card
                      </button>
                      <button
                        type="button"
                        onClick={close}
                        className="rounded-card border border-line px-4 py-2 text-sm font-semibold text-muted transition-colors hover:border-signal focus-visible:outline focus-visible:outline-2 focus-visible:outline-signal"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                </div>
              )
            ) : (
              <>
                <p className="text-[10px] font-semibold uppercase tracking-widest text-muted">
                  {live
                    ? `Founder №${selected.number} · ${TIER_STYLE[selected.tier].label} · Founded ${selected.year}`
                    : `${TIER_STYLE[selected.tier].label} · sample`}
                </p>
                <h3 className="mt-1 font-display text-2xl uppercase text-white">{selected.name}</h3>
                <p className="mt-3 text-sm text-muted">
                  {selected.message ?? 'Part of the founding generation of Trucking Life.'}
                </p>
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
