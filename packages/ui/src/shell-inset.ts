import { createContext, useContext } from "react";

/**
 * The height of the bottom bar for the screens inside the shell, so a toast can
 * stand above the bar (`ToastHost` adds it to its own offset) and a screen can
 * tell whether the bar already holds the bottom safe-area inset. 0 outside the
 * shell, when the shell has no bar (an anonymous screen) and on expanded
 * screens, where the bar is hidden.
 */
export const TabBarInsetContext = createContext(0);

/** The height the bottom tab bar takes on this screen: 56 or 0. */
export function useTabBarInset(): number {
  return useContext(TabBarInsetContext);
}
