import type { CSSProperties } from 'react';
import styles from './road-ahead.module.css';

/**
 * The museum atmosphere behind the Founder Wall — volumetric light shafts, a
 * slow gallery light-sweep, and drifting dust motes catching the light. Pure
 * CSS (no canvas, no JS animation loop), decorative (`aria-hidden`), and mounted
 * ONLY when motion is allowed, so a pause / reduced-motion request removes it
 * entirely. Mote positions are deterministic (index-hashed, no Math.random) so
 * the server and client render identically — no hydration mismatch.
 */

const MOTES = Array.from({ length: 22 }, (_, i) => i);

/**
 * @param style optional inline style — the wall passes `--p` (its own scroll
 *   progress) so the whole light field can dolly horizontally as the visitor
 *   scrolls the exhibit (a compositor-only transform; see `.atmosphere`).
 */
export function WallAtmosphere({ style }: { style?: CSSProperties }) {
  return (
    <div className={styles.atmosphere} aria-hidden="true" style={style}>
      <span
        className={styles.lightShaft}
        style={{ ['--a']: '-18deg', ['--x']: '22%' } as CSSProperties}
      />
      <span
        className={styles.lightShaft}
        style={{ ['--a']: '10deg', ['--x']: '54%' } as CSSProperties}
      />
      <span
        className={styles.lightShaft}
        style={{ ['--a']: '-6deg', ['--x']: '80%' } as CSSProperties}
      />
      <span className={styles.lightSweep} />
      <div className={styles.dustField}>
        {MOTES.map((i) => {
          const left = (i * 61) % 100;
          const size = 1 + ((i * 7) % 3);
          const delay = ((i * 37) % 80) / 10;
          const dur = 14 + ((i * 13) % 10);
          const drift = ((i * 29) % 40) - 20;
          return (
            <span
              key={i}
              className={styles.mote}
              style={
                {
                  left: `${left}%`,
                  width: `${size}px`,
                  height: `${size}px`,
                  ['--delay']: `${delay}s`,
                  ['--dur']: `${dur}s`,
                  ['--drift']: `${drift}px`,
                } as CSSProperties
              }
            />
          );
        })}
      </div>
    </div>
  );
}
