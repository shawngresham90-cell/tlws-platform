import type { CSSProperties } from 'react';
import styles from './road-ahead.module.css';

/**
 * Scene 4 — FIRST LIGHT atmosphere. "Then the sun comes up." A bright daybreak
 * for the gradient state (shown until real sunrise/hero footage is dropped in):
 * a brightening sky, the sun cresting the horizon with a strong bloom, a wide
 * anamorphic lens flare, and soft light rays — the hopeful lift of the trailer.
 *
 * Distinct from Scene 7's golden-hour legacy dusk: this is cooler up top, whiter
 * at the core, morning rather than evening. Pure CSS, decorative (`aria-hidden`),
 * mounted ONLY when motion is allowed AND the scene has no footage yet (a
 * dropped-in clip auto-replaces it), so pause / reduced-motion removes it
 * entirely. `--p` (scroll progress) raises and brightens the sun.
 */
export function FirstLightFX({ style }: { style?: CSSProperties }) {
  return (
    <div className={styles.firstLightFx} aria-hidden="true" style={style}>
      <span className={styles.flSky} />
      <span className={styles.flRays} />
      <span className={styles.flSun} />
      <span className={styles.flFlare} />
    </div>
  );
}
