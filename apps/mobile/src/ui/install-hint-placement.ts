import { breakpoints } from "@gift-list/ui";
import { useWindowDimensions } from "react-native";

/**
 * `DESIGN.md` → Широкий экран (UX-DR11): on a wide window the install hint lives
 * in the right column of a root screen, below it — as a card at the top of
 * «Найти знакомых» and «Профиля». The number comes from the same token the
 * catalog documents (`spacing.bp-wide`), so the two layouts cannot drift.
 */
export type InstallHintPlacement = "card" | "aside";

/** The window is wide enough for the right column. */
export function isInstallHintAside(width: number): boolean {
  return width >= breakpoints.wide;
}

/**
 * The placement of the current window. `useWindowDimensions` is the hook the card
 * grid already reads, so a browser resize follows the same source as the grid and
 * the screen never renders two copies of the hint.
 */
export function useInstallHintPlacement(): InstallHintPlacement {
  const { width } = useWindowDimensions();
  return isInstallHintAside(width) ? "aside" : "card";
}
