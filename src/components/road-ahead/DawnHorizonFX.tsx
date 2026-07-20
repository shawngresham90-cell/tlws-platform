import type { CSSProperties } from 'react';
import styles from './road-ahead.module.css';

/**
 * Scene 7 — LEGACY / dawn atmosphere. The emotional payoff: "somebody taught
 * you, now it's your turn." A sunrise breaks and warms as the visitor scrolls
 * in, god rays fan from the horizon, and a lone truck silhouette rolls toward
 * the light. Pure CSS/SVG, decorative (`aria-hidden`), mounted ONLY when motion
 * is allowed AND the scene has no footage yet (a dropped-in clip auto-replaces
 * it), so pause / reduced-motion removes it entirely. `--p` drives the sunrise.
 */
export function DawnHorizonFX({ style }: { style?: CSSProperties }) {
  return (
    <div className={styles.dawnFx} aria-hidden="true" style={style}>
      <span className={styles.dhSky} />
      <span className={styles.dhRays} />
      <span className={styles.dhSun} />
      <span className={styles.dhTruck}>
        <svg viewBox="0 0 120 40" preserveAspectRatio="xMidYMax meet" width="100%" height="100%">
          {/* Minimal tractor-trailer side silhouette rolling toward the light. */}
          <path
            d="M2 30 h58 v-14 h10 l8 8 v6 h6 v3 h-6 a5 5 0 0 1-10 0 h-30 a5 5 0 0 1-10 0 H2 z"
            fill="currentColor"
          />
        </svg>
      </span>
      <span className={styles.dhHaze} />
    </div>
  );
}
