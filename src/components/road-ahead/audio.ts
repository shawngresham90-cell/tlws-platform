'use client';

/**
 * Founders Movement — FM-3 cinematic audio engine (synthesized, swap-ready).
 *
 * Architecture: one master gain → three buses:
 *   ambience — engine idle + highway air (continuous once enabled)
 *   swell    — the dawn cue, triggered once as the visitor reaches the school
 *   sfx      — the single engrave thump used by the Induction
 *
 * Every source is registered in SOURCES as a builder function. Today each
 * builder synthesizes its sound (zero audio assets); commissioned recordings
 * swap in later by replacing a builder with a file-backed one — the buses,
 * cues, ducking, and UI contract do not change.
 *
 * Hard rules (unchanged since Phase 0):
 *  - OFF by default; the AudioContext is not constructed until the user's
 *    first explicit enable gesture. The stored preference is never used to
 *    auto-start audio — every visit begins silent.
 *  - 400ms fades; tab hidden ⇒ fade + suspend; visible + opted-in ⇒ resume.
 *  - No information is carried by audio alone; cues are pure atmosphere.
 */

type Listener = (on: boolean) => void;

const PREF_KEY = 'tlws-road-ahead-sound';
const FADE_S = 0.4;
const MASTER_LEVEL = 0.5;
const DAWN_TRIGGER = 0.8; // page-scroll fraction where the dawn swell begins

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambienceBus: GainNode | null = null;
let swellBus: GainNode | null = null;
let sfxBus: GainNode | null = null;
let on = false;
let wired = false;
let dawnPlayed = false;
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

/* ── Synth source builders (each swappable for a produced recording) ──────── */

function noiseBuffer(ac: AudioContext, seconds: number, brown: boolean): AudioBuffer {
  const len = Math.floor(ac.sampleRate * seconds);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < len; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  return buf;
}

/** Engine idle: brown noise → 90Hz lowpass, slow 0.16Hz breathing. */
function buildEngine(ac: AudioContext, out: GainNode): void {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, 2, true);
  src.loop = true;
  const lowpass = ac.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.value = 90;
  lowpass.Q.value = 0.7;
  const breathe = ac.createGain();
  breathe.gain.value = 0.8;
  const lfo = ac.createOscillator();
  lfo.frequency.value = 0.16;
  const depth = ac.createGain();
  depth.gain.value = 0.15;
  lfo.connect(depth);
  depth.connect(breathe.gain);
  src.connect(lowpass);
  lowpass.connect(breathe);
  breathe.connect(out);
  src.start();
  lfo.start();
}

/** Highway air: faint band-passed white noise with a slow drift — distance. */
function buildHighway(ac: AudioContext, out: GainNode): void {
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, 3, false);
  src.loop = true;
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 620;
  band.Q.value = 0.5;
  const level = ac.createGain();
  level.gain.value = 0.045;
  const lfo = ac.createOscillator();
  lfo.frequency.value = 0.07;
  const depth = ac.createGain();
  depth.gain.value = 0.02;
  lfo.connect(depth);
  depth.connect(level.gain);
  src.connect(band);
  band.connect(level);
  level.connect(out);
  src.start();
  lfo.start();
}

/**
 * Dawn swell: two soft detuned triads (A2 + E3 + A3) opening through a
 * lowpass over ~4s, holding low, then releasing — played once, keyed to the
 * school arriving. Replace this builder with the commissioned bed later.
 */
function cueDawnSwellSynth(ac: AudioContext, out: GainNode): void {
  const now = ac.currentTime;
  const lowpass = ac.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(180, now);
  lowpass.frequency.linearRampToValueAtTime(900, now + 5);
  const env = ac.createGain();
  env.gain.setValueAtTime(0, now);
  env.gain.linearRampToValueAtTime(0.16, now + 4);
  env.gain.setValueAtTime(0.16, now + 9);
  env.gain.linearRampToValueAtTime(0, now + 14);
  lowpass.connect(env);
  env.connect(out);
  for (const [freq, detune, level] of [
    [110, 0, 0.5],
    [164.8, 4, 0.35],
    [220, -3, 0.3],
  ] as const) {
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    osc.detune.value = detune;
    const g = ac.createGain();
    g.gain.value = level;
    osc.connect(g);
    g.connect(lowpass);
    osc.start(now);
    osc.stop(now + 14.5);
  }
}

/** Engrave thump: one 120ms low sine + filtered noise tap. Induction only. */
function cueEngraveSynth(ac: AudioContext, out: GainNode): void {
  const now = ac.currentTime;
  const sine = ac.createOscillator();
  sine.frequency.setValueAtTime(72, now);
  sine.frequency.exponentialRampToValueAtTime(48, now + 0.12);
  const sEnv = ac.createGain();
  sEnv.gain.setValueAtTime(0.5, now);
  sEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
  sine.connect(sEnv);
  sEnv.connect(out);
  sine.start(now);
  sine.stop(now + 0.2);
  const tap = ac.createBufferSource();
  tap.buffer = noiseBuffer(ac, 0.1, false);
  const tapFilter = ac.createBiquadFilter();
  tapFilter.type = 'lowpass';
  tapFilter.frequency.value = 500;
  const tEnv = ac.createGain();
  tEnv.gain.setValueAtTime(0.15, now);
  tEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
  tap.connect(tapFilter);
  tapFilter.connect(tEnv);
  tEnv.connect(out);
  tap.start(now);
}

/* ── Engine lifecycle ─────────────────────────────────────────────────────── */

function fadeTo(target: number, seconds = FADE_S) {
  if (!ctx || !master) return;
  const now = ctx.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.setValueAtTime(master.gain.value, now);
  master.gain.linearRampToValueAtTime(target, now + seconds);
}

function wireLifecycle() {
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
      void ctx.resume().then(() => fadeTo(MASTER_LEVEL));
    }
  });
  // Dawn cue: fires once, only while sound is on, as the school approaches.
  window.addEventListener(
    'scroll',
    () => {
      if (!on || dawnPlayed || !ctx || !swellBus) return;
      const doc = document.documentElement;
      const max = Math.max(1, doc.scrollHeight - window.innerHeight);
      if (window.scrollY / max >= DAWN_TRIGGER) {
        dawnPlayed = true;
        cueDawnSwellSynth(ctx, swellBus);
      }
    },
    { passive: true },
  );
}

function buildGraph(ac: AudioContext): void {
  master = ac.createGain();
  master.gain.value = 0;
  master.connect(ac.destination);
  ambienceBus = ac.createGain();
  ambienceBus.gain.value = 1;
  ambienceBus.connect(master);
  swellBus = ac.createGain();
  swellBus.gain.value = 1;
  swellBus.connect(master);
  sfxBus = ac.createGain();
  sfxBus.gain.value = 1;
  sfxBus.connect(master);
  buildEngine(ac, ambienceBus);
  buildHighway(ac, ambienceBus);
}

/** User gesture handler — the only way audio ever starts. */
export async function enableSound(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (!ctx) {
    ctx = new AudioContext();
    buildGraph(ctx);
    wireLifecycle();
  }
  await ctx.resume();
  fadeTo(MASTER_LEVEL);
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

/**
 * One carve tick — the chisel scrape for a single letter as it's cut into the
 * material. `material` shapes the timbre (bright metal scrape vs. duller stone),
 * `index` nudges the pitch a touch per letter so a name doesn't machine-gun the
 * same tone. Short and quiet by design: many of these fire in a row. No-op when
 * sound is off.
 */
export function cueCarveTick(material: 'metal' | 'stone', index = 0): void {
  if (!on || !ctx || !sfxBus) return;
  const ac = ctx;
  const now = ac.currentTime;
  const src = ac.createBufferSource();
  src.buffer = noiseBuffer(ac, 0.09, false);
  const band = ac.createBiquadFilter();
  band.type = 'bandpass';
  const base = material === 'stone' ? 680 : 1900;
  band.frequency.value = base + ((index % 5) - 2) * 70;
  band.Q.value = material === 'stone' ? 1.2 : 2.4;
  const env = ac.createGain();
  const peak = material === 'stone' ? 0.085 : 0.055;
  const dur = material === 'stone' ? 0.055 : 0.04;
  env.gain.setValueAtTime(0.0001, now);
  env.gain.exponentialRampToValueAtTime(peak, now + 0.004);
  env.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  src.connect(band);
  band.connect(env);
  env.connect(sfxBus);
  src.start(now);
  src.stop(now + 0.09);
  if (material === 'stone') {
    // A faint low knock under the scrape — the grit of stone.
    const knock = ac.createOscillator();
    knock.frequency.setValueAtTime(150, now);
    knock.frequency.exponentialRampToValueAtTime(90, now + 0.05);
    const kEnv = ac.createGain();
    kEnv.gain.setValueAtTime(0.05, now);
    kEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    knock.connect(kEnv);
    kEnv.connect(sfxBus);
    knock.start(now);
    knock.stop(now + 0.07);
  }
}

/**
 * The finish beat once a name is fully cut: a subtle struck-metal ring for the
 * metal plaques, or a low stone-settle thud for brick. No-op when sound is off.
 */
export function cueCarveFinish(material: 'metal' | 'stone'): void {
  if (!on || !ctx || !sfxBus) return;
  const ac = ctx;
  const now = ac.currentTime;
  if (material === 'metal') {
    // A short, bright ring — two partials with a quick transient.
    for (const [freq, level, decay] of [
      [1180, 0.09, 0.5],
      [1760, 0.05, 0.4],
    ] as const) {
      const osc = ac.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;
      const env = ac.createGain();
      env.gain.setValueAtTime(level, now);
      env.gain.exponentialRampToValueAtTime(0.0005, now + decay);
      osc.connect(env);
      env.connect(sfxBus);
      osc.start(now);
      osc.stop(now + decay + 0.05);
    }
    const tick = ac.createBufferSource();
    tick.buffer = noiseBuffer(ac, 0.05, false);
    const tEnv = ac.createGain();
    tEnv.gain.setValueAtTime(0.12, now);
    tEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    tick.connect(tEnv);
    tEnv.connect(sfxBus);
    tick.start(now);
  } else {
    // A low settle — the brick locking into the course.
    const sine = ac.createOscillator();
    sine.frequency.setValueAtTime(96, now);
    sine.frequency.exponentialRampToValueAtTime(58, now + 0.18);
    const env = ac.createGain();
    env.gain.setValueAtTime(0.34, now);
    env.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
    sine.connect(env);
    env.connect(sfxBus);
    sine.start(now);
    sine.stop(now + 0.26);
    const grit = ac.createBufferSource();
    grit.buffer = noiseBuffer(ac, 0.1, false);
    const gFilter = ac.createBiquadFilter();
    gFilter.type = 'lowpass';
    gFilter.frequency.value = 420;
    const gEnv = ac.createGain();
    gEnv.gain.setValueAtTime(0.12, now);
    gEnv.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    grit.connect(gFilter);
    gFilter.connect(gEnv);
    gEnv.connect(sfxBus);
    grit.start(now);
  }
}

/* ── Induction cues ───────────────────────────────────────────────────────── */

/** The single engrave thump. No-op when sound is off. */
export function cueEngrave(): void {
  if (!on || !ctx || !sfxBus) return;
  cueEngraveSynth(ctx, sfxBus);
}

/**
 * Duck everything to near-silence for the name reveal, then restore.
 * The quiet IS the ceremony's sound design. No-op when sound is off.
 */
export function duckForReveal(holdMs = 2600): void {
  if (!on || !ctx || !master) return;
  fadeTo(MASTER_LEVEL * 0.12, 0.3);
  window.setTimeout(() => {
    if (on) fadeTo(MASTER_LEVEL, 1.2);
  }, holdMs);
}
