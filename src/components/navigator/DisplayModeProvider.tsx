'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import {
  DEFAULT_DISPLAY_MODE,
  resolveTheme,
  themeAttribute,
  type DisplayMode,
  type DisplayTheme,
} from '@/lib/navigator/display-mode';
import { readDisplayMode, writeDisplayMode } from './display-storage';

/**
 * The one thing that decides which Navigator palette is painted
 * (NAV-ENTRY-1).
 *
 * It lives in the (navigator) route-group layout, which means it stays
 * mounted across the launcher, the driving screen and Settings — one instance
 * for the whole Navigator session. That is not tidiness: a provider mounted
 * per page would create and tear down a `matchMedia` listener on every
 * navigation, and the leak that produces is exactly the kind nobody notices
 * until a phone gets warm on a ten-hour drive.
 *
 * WHY THE ATTRIBUTE, NOT A CLASS OR A STATE PROP. The day palette already
 * ships as `[data-theme='day']` in navigator-design.css, complete and
 * dormant. Setting one attribute activates the whole palette at once, in CSS,
 * with no component anywhere needing to know which colours it is using. The
 * alternative — threading a theme prop through the tree — would mean every
 * component gets a chance to disagree about the palette, and some eventually
 * would.
 *
 * NIGHT IS THE ABSENCE OF THE ATTRIBUTE, because night is `:root` itself.
 * `themeAttribute` returns null for night so no caller can invent a third
 * palette by writing a value the stylesheet has never heard of.
 *
 * PRESENTATION ONLY. Nothing here reads a position, spends a provider call,
 * touches the lifecycle, or remounts a map.
 */

const DARK_QUERY = '(prefers-color-scheme: dark)';

type DisplayContextValue = {
  /** What the driver chose: automatic, night or day. */
  mode: DisplayMode;
  /** What is actually painted right now. */
  theme: DisplayTheme;
  /** The phone's own preference, or null where it cannot be read. */
  prefersDark: boolean | null;
  setMode: (next: DisplayMode) => void;
};

const DisplayContext = createContext<DisplayContextValue | null>(null);

/**
 * The current display state.
 *
 * Returns a safe default outside a provider rather than throwing: a
 * presentation preference must never be the reason a driving surface fails to
 * render. (The safety lock threw, and was right to — a missing SAFETY
 * authority is a real defect. A missing palette is not.)
 */
export function useDisplayMode(): DisplayContextValue {
  return (
    useContext(DisplayContext) ?? {
      mode: DEFAULT_DISPLAY_MODE,
      theme: resolveTheme(DEFAULT_DISPLAY_MODE, null),
      prefersDark: null,
      setMode: () => {},
    }
  );
}

export function DisplayModeProvider({ children }: { children: ReactNode }) {
  /*
   * Both start at their documented defaults so the server's paint and the
   * client's first paint agree. The effects below adopt the real values —
   * the same discipline every other stored Navigator record follows.
   */
  const [mode, setModeState] = useState<DisplayMode>(DEFAULT_DISPLAY_MODE);
  const [prefersDark, setPrefersDark] = useState<boolean | null>(null);

  useEffect(() => {
    setModeState(readDisplayMode());
  }, []);

  /*
   * ONE listener, and it is a subscription rather than a poll. The phone's
   * preference can change mid-drive — most phones flip it on a schedule — and
   * the screen has to follow without the driver touching anything. There is
   * no interval here and there must never be one: `matchMedia` already
   * notifies, and polling for a value the browser will hand you is a battery
   * cost with no benefit.
   */
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const query = window.matchMedia(DARK_QUERY);
    setPrefersDark(query.matches);
    const onChange = (event: MediaQueryListEvent) => setPrefersDark(event.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  const theme = resolveTheme(mode, prefersDark);

  /*
   * The attribute goes on the document element so the page's own background
   * follows the palette, not just the components inside this subtree — a
   * cockpit with day surfaces floating on a night page is worse than either
   * mode. It is removed on unmount, so leaving Navigator leaves nothing
   * behind on the rest of the site.
   */
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const attribute = themeAttribute(theme);
    if (attribute === null) root.removeAttribute('data-theme');
    else root.setAttribute('data-theme', attribute);
    return () => root.removeAttribute('data-theme');
  }, [theme]);

  const setMode = useCallback((next: DisplayMode) => {
    setModeState(next);
    writeDisplayMode(next);
  }, []);

  const value = useMemo(
    () => ({ mode, theme, prefersDark, setMode }),
    [mode, theme, prefersDark, setMode],
  );
  return <DisplayContext.Provider value={value}>{children}</DisplayContext.Provider>;
}
