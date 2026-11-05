/**
 * Focus helpers moved to `@gift-list/ui` (`restoreFocus`, `focusInLayer`): the layers
 * there return focus themselves. This file only keeps the names the screens import
 * until they move to the package directly.
 */
export { focusInLayer, restoreFocus, type FocusTarget } from "@gift-list/ui";
export type { FocusTarget as ChipNode } from "@gift-list/ui";
