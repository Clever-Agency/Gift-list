import { spacing } from "./tokens";

/**
 * The busy indicator of `DESIGN.md` → Состояния кнопок → busy and → Движение: a
 * 16 px spinner that turns linearly, and stands still with «уменьшить движение».
 * The numbers live here because the web and the phone twins of `Spinner` and
 * their tests read the same values (like `motion.ts` for the layers).
 */

/** The edge of the spinner box: `{spacing.icon-small}` = 16 (`DESIGN.md` → busy). */
export const SPINNER_SIZE = spacing["icon-small"];

/**
 * One full turn, milliseconds. `DESIGN.md` fixes the motion (linear, no easing)
 * but not the duration; 800 ms is the usual pace of a "still working" indicator
 * and is slow enough to read as waiting rather than as a flash.
 */
export const SPINNER_PERIOD_MS = 800;
