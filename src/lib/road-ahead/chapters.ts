import { sceneBackdropSlot, type SceneId } from './assets';

/**
 * The seven-scene spine of THE ROAD AHEAD (the locked treatment). One ordered
 * list, shared by the experience (render order), the progress rail, and the
 * skip-to-scene nav, so the story, navigation, and analytics can never disagree
 * about what the scenes are or their order.
 *
 * Scenes 5 (Founder Wall) and 6 (Name Engraving) carry no video by design.
 *
 * Pure data — validated by scripts/test-road-ahead.ts (unique ids, contiguous
 * order, every video scene resolves a backdrop slot).
 */

export type ChapterId = SceneId;

export type ChapterConfig = {
  id: ChapterId;
  /** 0-based position in the story. */
  index: number;
  /** Short label for the progress rail and the skip-nav. */
  label: string;
  /** Anchor id used for in-page navigation (`#<anchor>`). */
  anchor: string;
  /** Whether this scene renders footage (false = 3D wall / engraving). */
  hasVideo: boolean;
};

export const ROAD_AHEAD_CHAPTERS: ChapterConfig[] = [
  { id: 'nightDrive', index: 0, label: 'Night', anchor: 'scene-night', hasVideo: true },
  { id: 'preTrip', index: 1, label: 'The Pre-Trip', anchor: 'scene-pretrip', hasVideo: true },
  { id: 'theGrind', index: 2, label: 'The Grind', anchor: 'scene-grind', hasVideo: true },
  { id: 'firstLight', index: 3, label: 'First Light', anchor: 'scene-firstlight', hasVideo: true },
  { id: 'foundersWall', index: 4, label: 'The Wall', anchor: 'scene-wall', hasVideo: false },
  { id: 'nameEngraving', index: 5, label: 'Your Name', anchor: 'scene-name', hasVideo: false },
  { id: 'thePayoff', index: 6, label: 'The Payoff', anchor: 'scene-payoff', hasVideo: true },
];

export function getChapter(id: ChapterId): ChapterConfig | undefined {
  return ROAD_AHEAD_CHAPTERS.find((c) => c.id === id);
}

/** Validate the scene spine. Returns human-readable problems (empty = ok). */
export function validateChapters(): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  const anchors = new Set<string>();

  ROAD_AHEAD_CHAPTERS.forEach((c, i) => {
    if (ids.has(c.id)) problems.push(`duplicate scene id "${c.id}"`);
    ids.add(c.id);
    if (anchors.has(c.anchor)) problems.push(`duplicate scene anchor "${c.anchor}"`);
    anchors.add(c.anchor);
    if (c.index !== i)
      problems.push(`scene "${c.id}" index ${c.index} is not contiguous (expected ${i})`);
    if (!c.anchor || c.anchor.trim().length === 0)
      problems.push(`scene "${c.id}" is missing an anchor`);
    if (c.hasVideo) {
      const slot = sceneBackdropSlot(c.id);
      if (!slot.gradient || slot.gradient.trim().length === 0) {
        problems.push(`scene "${c.id}" is a video scene but its backdrop has no gradient fallback`);
      }
    }
  });

  return problems;
}
