import type { ReactNode } from "react";

/**
 * The safe frame of a screen (`DESIGN.md` → App; AD-2, DECISION 2026-11-10).
 * The wrapper has no API, env, data or text: the screen puts its one page inside.
 */
export type SafeAreaProps = {
  children?: ReactNode;
  /**
   * Keep the bottom inset. Default `true`: a page outside the tab shell holds the
   * home indicator itself. Inside the shell the bar already keeps the bottom
   * inset, and the frame drops it on its own (`useTabBarInset`), so adding it
   * again would fold the home indicator twice (`EXPERIENCE.md` → Навигация).
   * `false` drops the bottom edge in every case — a root tab screen says it
   * explicitly, and an anonymous screen without a bar keeps the default.
   */
  bottom?: boolean;
};
