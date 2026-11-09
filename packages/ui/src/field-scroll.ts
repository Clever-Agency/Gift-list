import type { PageScrollRegistration } from "./field-scroll.types";

/**
 * The web side of the shared page scroller. A browser form field already scrolls
 * itself with `scrollIntoView` in `focus.ts`, so there is nothing to register and
 * nothing to move before focus: the callback runs at once.
 */
export function registerPageScroll(registration: PageScrollRegistration): () => void {
  // The argument keeps the shared signature; the browser page keeps no state.
  void registration;
  return function unregisterPageScroll() {};
}

/** Web: the field's own `focusField` handles the scroll, so only continue. */
export function scrollFieldIntoView(_node: object, onDone: () => void): void {
  onDone();
}
