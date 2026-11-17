import type { ReactNode } from "react";

/**
 * The safe frame of a screen (`DESIGN.md` → App; AD-2, DECISION 2026-11-10).
 * The wrapper has no API, env, data or text: the screen puts its one page inside.
 */
export type SafeAreaProps = {
  children?: ReactNode;
};
