'use client';

/**
 * Founders Movement — placeholder audio engine (POC).
 *
 * Zero audio assets: a synthesized low engine-style rumble (looped brown-noise
 * buffer → low-pass filter → slowly breathing gain) stands in for the produced
 * ambience bed described in docs/founders-movement-experience.md §7. The
 * production engine keeps this exact interface and only swaps sources.
 *
 * Hard rules implemented here:
 *  - OFF by default; the AudioContext is not even constructed until the user's
 *    first explicit enable gesture (satisfies autoplay policies by design).
 *  - 400ms fades in/out; tab hidden ⇒ fade + suspend, visible ⇒ resume.
 *  - The stored preference is written for future visits but is NEVER used to
 *    auto-start audio on load — every visit begins silent.
 */

type Listener = (on: boolean) => void;

const PREF_KEY = 'tlws-fm-sound';
const FADE_S = 0.4;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let on = false;
let wired = false;
const listeners = new Set<Listener>();

function emit() {
  listeners.forEach((l) => l(on));
}

/** Subscribe to on/off changes; returns an unsubscribe fn. */
export function subscribeSound(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function soundOn(): boolean {
  return on;
}

function buildGraph(ac: AudioContext): GainNode {
  // 2s brown-noise loop.
  const len = ac.sampleRate * 2;
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5;
  }
  const src = ac.createBufferSource();
  src.buffer = buf;
  src.loop = true;

  const lowpass = ac.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 90;
  lowpass.Q.value = 0.7;

  // Slow "breathing" so the idle feels alive, never looping-obvious.
  const breathe = ac.createGain();
  breathe.gain.value = 0.8;
  const lfo = ac.createOscillator();
  lfo.frequency.value = 0.16;
  const lfoDepth = ac.createGain();
  lfoDepth.gain.value = 0.15;
  lfo.connect(lfoDepth);
  lfoDepth.connect(breathe.gain);

  const out = ac.createGain();
  out.gain.value = 0; // faded in on enable

  src.connect(lowpass);
  lowpass.connect(breathe);
  breathe.connect(out);
  out.connect(ac.destination);
  src.start();
  lfo.start();
  return out;
}

function fadeTo(target: number) {
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.linearRampToValueAtTime(target, now + FADE_S);
}

function wireVisibility() {
  if (wired || typeof document === 'undefined') return;
  wired = true;
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return;
    if (document.hidden) {
      fadeTo(0);
      window.setTimeout(
        () => {
          if (document.hidden) void ctx?.suspend();
        },
        FADE_S * 1000 + 50,
      );
    } else if (on) {
      void ctx.resume().then(() => fadeTo(0.5));
    }
  });
}

/** User gesture handler — the only way audio ever starts. */
export async function enableSound(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!ctx) {
    ctx = new AudioContext();
    master = buildGraph(ctx);
    wireVisibility();
  }
  await ctx.resume();
  fadeTo(0.5);
  on = true;
  try {
    localStorage.setItem(PREF_KEY, 'on');
  } catch {
    /* private mode — preference just isn't remembered */
  }
  emit();
}

export function disableSound(): void {
  if (ctx) {
    fadeTo(0);
    window.setTimeout(
      () => {
        if (!on) void ctx?.suspend();
      },
      FADE_S * 1000 + 50,
    );
  }
  on = false;
  try {
    localStorage.setItem(PREF_KEY, 'off');
  } catch {
    /* ignore */
  }
  emit();
}

export async function toggleSound(): Promise<void> {
  if (on) disableSound();
  else await enableSound();
}
