import type { ReactNode } from "react";

/**
 * The safe frame of a screen (`DESIGN.md` → App; AD-2, DECISION 2026-11-10).
 * The wrapper has no API, env, data or text: the screen puts its one page inside.
 */
export type SafeAreaProps = {
  children?: ReactNode;
  /**
   * Keep the bottom inset. Default `true`: a nested screen or a page outside the
   * tab shell holds the home indicator itself. A screen inside the tab bar passes
   * `false` — the bar already keeps the bottom inset, and adding it again would
   * fold the home indicator twice (`EXPERIENCE.md` → Навигация).
   */
  bottom?: boolean;
};
