'use client';

import type { CSSProperties } from 'react';
import { cn } from '@/lib/utils/cn';
import type { ChapterConfig } from '@/lib/road-ahead/chapters';
import styles from './road-ahead.module.css';

/**
 * Fixed chapter rail (desktop): a vertical progress line plus a dot per chapter
 * that doubles as skip-navigation. `aria-current="step"` marks the active
 * chapter; each dot is a real anchor link, so keyboard and screen-reader users
 * can jump straight to any beat. Hidden below lg — mobile uses the in-page
 * skip-nav at the top of the experience instead.
 */
export function ProgressRail({
  chapters,
  activeChapter,
  scrollProgress,
}: {
  chapters: ChapterConfig[];
  activeChapter: number;
  scrollProgress: number;
}) {
  return (
    <nav
      aria-label="Chapter navigation"
      className="fixed right-6 top-1/2 z-40 hidden -translate-y-1/2 lg:block"
    >
      <ol className="relative flex flex-col gap-6 pl-1">
        <span aria-hidden="true" className="absolute left-[3px] top-1 bottom-1 w-px bg-line" />
        <span
          aria-hidden="true"
          className={cn(
            'absolute left-[3px] top-1 bottom-1 w-px origin-top bg-signal',
            styles.railFill,
          )}
          style={{ ['--p']: scrollProgress } as CSSProperties}
        />
        {chapters.map((c, i) => {
          const done = i <= activeChapter;
          const active = i === activeChapter;
          return (
            <li key={c.id} className="relative">
              <a
                href={`#${c.anchor}`}
                aria-current={active ? 'step' : undefined}
                className="group flex items-center gap-3 focus-visible:outline-none"
              >
                <span
                  className={cn(
                    'h-2 w-2 shrink-0 rounded-full border transition-colors',
                    done ? 'border-signal bg-signal' : 'border-muted bg-asphalt',
                    'group-focus-visible:ring-2 group-focus-visible:ring-signal group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-asphalt',
                  )}
                />
                <span
                  className={cn(
                    'whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide transition-opacity',
                    active
                      ? 'text-signal opacity-100'
                      : 'text-muted opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100',
                  )}
                >
                  {c.label}
                </span>
              </a>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
