'use client';

import { useEffect, useState } from 'react';
import { subscribePreviewIdentity, getPreviewIdentity, type PreviewIdentity } from './identity';

/**
 * FM-3: the page's last word becomes the visitor's.
 *
 * If they previewed their name in the Induction, the finale signs off with
 * it — name, founder number, and the vow. In-memory only: refresh and it is
 * gone, which is itself the point. Renders nothing until an identity exists,
 * so the server-rendered finale is unchanged for SEO, no-JS, and everyone
 * who hasn't stepped up to the wall yet.
 */
export function LegacySignature() {
  const [identity, setIdentity] = useState<PreviewIdentity>(null);

  useEffect(() => {
    setIdentity(getPreviewIdentity());
    return subscribePreviewIdentity(setIdentity);
  }, []);

  if (!identity) return null;
  return (
    <p className="mt-4 border-l-2 border-signal/50 pl-4 font-display text-lg uppercase tracking-widest text-ink">
      {identity.name}
      <span className="mt-1 block text-xs tracking-[0.3em] text-signal">
        Founder №{identity.number} · I was here when it began.
      </span>
    </p>
  );
}
