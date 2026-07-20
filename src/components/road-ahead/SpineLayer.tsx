'use client';

import { Component, type ReactNode, useState } from 'react';
import dynamic from 'next/dynamic';

/**
 * Lazy loader + safety boundary for the WebGL truck spine — the one genuinely
 * 3D "wow" of THE ROAD AHEAD. The three.js / R3F chunk is code-split behind
 * `next/dynamic` (ssr: false) so it never touches the route-initial bundle and
 * only downloads once the capability ladder (useCinemaTier) has decided this
 * device can handle it.
 *
 * Because the spine is a pure enhancement, it must NEVER be able to take the
 * page down. Two independent nets guarantee that:
 *   1. an error boundary catches any render-time exception in three/R3F and
 *      drops straight back to the native CSS scenes (no crash screen);
 *   2. a WebGL context-loss handler inside the canvas removes it and calls
 *      onFail.
 * Either way the experience continues on the lite path with no gap.
 */
const SpineCanvas = dynamic(() => import('./spine/SpineCanvas'), { ssr: false });

class SpineErrorBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export function SpineLayer({ onFail }: { onFail: () => void }) {
  const [dead, setDead] = useState(false);
  if (dead) return null;
  const die = () => {
    setDead(true);
    onFail();
  };
  return (
    <SpineErrorBoundary onError={die}>
      <SpineCanvas onFail={die} />
    </SpineErrorBoundary>
  );
}
