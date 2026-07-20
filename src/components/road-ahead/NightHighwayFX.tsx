import type { CSSProperties } from 'react';
import styles from './road-ahead.module.css';

/**
 * Scene 1 — DARK HIGHWAY atmosphere. A Hollywood-trailer cold open for the
 * gradient state (shown until real night footage is dropped in). Pure CSS,
 * decorative (`aria-hidden`), mounted ONLY when motion is allowed AND the scene
 * has no footage yet — so a dropped-in clip auto-replaces it with zero code
 * changes, and pause / reduced-motion removes it entirely.
 *
 * Layers, back to front: a deep sky wash, a distant horizon glow that swells
 * with scroll (the "something bigger" you drive toward), converging center-line
 * dashes streaking under the camera (the drive), a pair of soft oncoming
 * headlights that pass on a long cycle, and a low drifting fog. `--p` (the
 * scene's own scroll progress) drives the dramatic build.
 */
export function NightHighwayFX({ style }: { style?: CSSProperties }) {
  return (
    <div className={styles.nightFx} aria-hidden="true" style={style}>
      <span className={styles.nhSky} />
      <span className={styles.nhHorizon} />
      <span className={styles.nhRoad}>
        <span className={styles.nhLanes} />
      </span>
      <span className={styles.nhOncoming} style={{ ['--d']: '0s' } as CSSProperties} />
      <span className={styles.nhOncoming} style={{ ['--d']: '9s' } as CSSProperties} />
      <span className={styles.nhFog} />
    </div>
  );
}
