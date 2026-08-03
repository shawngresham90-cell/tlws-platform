'use client';

import { useEffect, useState } from 'react';
import {
  installAvailability,
  readInstallEnvironment,
  type InstallAvailability,
} from '@/lib/pwa/install-prompt';
import { trackEvent } from '@/lib/analytics';

/**
 * "Add TLWS to your home screen" card — the first UI wired to the install
 * detection in lib/pwa/install-prompt.ts (which shipped inert, ahead of this
 * milestone, exactly so this component would not have to re-derive it).
 *
 * Renders nothing on the server, nothing when already installed, and nothing
 * in environments with no install path (in-app webviews, alternative iOS
 * browsers, desktop browsers without the prompt) — the detection fails
 * closed, so nobody is told to look for a button their browser doesn't have.
 */

/** Chromium's non-standard install event — not in lib.dom. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

export function InstallCard() {
  const [availability, setAvailability] = useState<InstallAvailability | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    setAvailability(installAvailability(readInstallEnvironment(window)));

    const capture = (event: Event) => {
      // Suppress Chrome's own mini-infobar; the card below is the surface.
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', capture);
    const installed = () => {
      setDone(true);
      trackEvent('pwa_installed');
    };
    window.addEventListener('appinstalled', installed);
    return () => {
      window.removeEventListener('beforeinstallprompt', capture);
      window.removeEventListener('appinstalled', installed);
    };
  }, []);

  if (!availability || availability.kind === 'installed' || availability.kind === 'unsupported') {
    return null;
  }

  const promptInstall = async () => {
    if (!deferred) return;
    trackEvent('pwa_install_prompted');
    await deferred.prompt();
    const choice = await deferred.userChoice;
    trackEvent('pwa_install_choice', { outcome: choice.outcome });
    setDeferred(null);
  };

  return (
    <div className="rounded-card border border-line bg-cab p-6">
      <p className="text-eyebrow font-semibold uppercase tracking-[0.15em] text-muted">
        On your phone
      </p>
      <h3 className="mt-2 font-display text-xl uppercase text-ink">
        Add TLWS to your home screen<span className="text-signal">.</span>
      </h3>

      {done ? (
        <p className="mt-3 text-sm text-marker-300">Installed — check your home screen.</p>
      ) : availability.kind === 'ios-manual' ? (
        // iOS Safari has no install prompt; the Share sheet is the only route.
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-muted">
          <li>
            Tap the <span className="text-ink">Share</span> button in Safari
          </li>
          <li>
            Scroll and tap <span className="text-ink">Add to Home Screen</span>
          </li>
          <li>
            Tap <span className="text-ink">Add</span> — the TL icon lands on your home screen
          </li>
        </ol>
      ) : deferred ? (
        <>
          <p className="mt-3 text-sm text-muted">
            One tap, opens full-screen like an app, no app store needed.
          </p>
          <button
            type="button"
            onClick={promptInstall}
            className="mt-4 rounded-card bg-signal px-6 py-3 font-display text-lg uppercase tracking-wide text-asphalt transition-colors hover:bg-signal-600"
          >
            Install the app
          </button>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">
          In your browser menu, choose <span className="text-ink">Install app</span> (or{' '}
          <span className="text-ink">Add to Home screen</span>).
        </p>
      )}
    </div>
  );
}
