'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LAUNCHER_ACTIONS, type LauncherAction } from '@/lib/navigator/navigator-entry';
import { primeSpeech } from './speech-unlock';
import { voiceEnabledByDefault } from './voice-storage';

/**
 * The Navigator launcher (NAV-ENTRY-1) — the first useful screen after the
 * access gate, and deliberately the smallest one in the app.
 *
 * THREE BUTTONS. Not three buttons and a settings shortcut, not three buttons
 * and a "quick setup" card. The list comes from `LAUNCHER_ACTIONS`, which the
 * harness counts, so a fourth action cannot be added here without turning the
 * suite red.
 *
 * WHAT THIS SCREEN MUST NOT DO, all of it asserted rather than intended:
 * request location, request a route, spend a provider transaction, start
 * speech recognition, read an account, or render a setup form. It is three
 * links and a heading. The only side effect in the file is the speech unlock
 * below, and that one runs on a tap rather than on load.
 *
 * WHY REAL LINKS. `next/link` gives a driver back-button behaviour that
 * matches every other page they use, keeps a long-press "open in new tab"
 * working, and survives a refresh — a button with `router.push` would give up
 * all three for nothing. Each href is a real gated route, so a typed URL
 * lands in the same place as a tap.
 */

export function NavigatorLauncher() {
  /*
   * Whether voice is on, read on mount so the Start Driving handler knows
   * whether it should spend this gesture unlocking the engine.
   *
   * `null` while unread rather than `true`: it is only used inside a click
   * that cannot happen before the effect has run, and starting at a guess is
   * how a driver who turned voice off gets spoken to anyway.
   */
  const [voiceWanted, setVoiceWanted] = useState<boolean | null>(null);
  useEffect(() => {
    setVoiceWanted(voiceEnabledByDefault());
  }, []);

  /**
   * THE GESTURE. This runs inside the tap, synchronously, before the
   * navigation — which is the whole reason it exists here rather than on the
   * driving screen. A browser will not unlock speech for a handler that
   * awaited something first, and by the time the map has mounted the gesture
   * is long gone.
   *
   * A driver who turned voice OFF gets no sound and no unlock: their choice
   * is the whole input, and the tap does nothing but navigate.
   */
  const onStartDriving = () => {
    if (voiceWanted === true) primeSpeech();
  };

  return (
    <div className="space-y-4" data-navigator-launcher="">
      {LAUNCHER_ACTIONS.map((action) => (
        <LauncherButton
          key={action.id}
          action={action}
          onActivate={action.id === 'start-driving' ? onStartDriving : undefined}
        />
      ))}
    </div>
  );
}

function LauncherButton({
  action,
  onActivate,
}: {
  action: LauncherAction;
  onActivate?: () => void;
}) {
  return (
    <Link
      href={action.href}
      onClick={onActivate}
      data-launcher-action={action.id}
      /*
       * `min-h-[6rem]` is 96px — comfortably over the 64px floor the brief
       * sets, because this is the one screen a driver uses with gloves on
       * while deciding what the next hour looks like. The text sizes are
       * absolute rather than clamped so a 200% browser zoom scales them: the
       * button grows, the words stay whole, and nothing is cut off.
       */
      className="flex min-h-[6rem] w-full flex-col justify-center gap-1 rounded-cockpit border border-line bg-nav-surface px-5 py-4 text-left"
    >
      <span className="font-display text-2xl uppercase tracking-wide text-ink">{action.label}</span>
      <span className="text-lg text-ink/70">{action.supporting}</span>
    </Link>
  );
}
