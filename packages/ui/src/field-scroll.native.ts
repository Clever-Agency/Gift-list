import type { MeasurableNode, PageScrollRegistration } from "./field-scroll.types";

/**
 * Mounted pages, bottom of the navigation stack first. Expo Router keeps the
 * lower screens mounted, so a push must not lose the page underneath and a pop
 * must expose it again: the last entry is the page on top.
 */
const pages: PageScrollRegistration[] = [];

/** Called by `PageScroll` on mount; the returned function releases this page. */
export function registerPageScroll(registration: PageScrollRegistration): () => void {
  pages.push(registration);
  return function unregisterPageScroll() {
    const index = pages.lastIndexOf(registration);
    if (index !== -1) pages.splice(index, 1);
  };
}

/**
 * UI5 (review): on the phone a failed submit brings the first invalid field to
 * the middle of the screen, then focus opens the keyboard. `EXPERIENCE.md` →
 * Accessibility Floor asks focus to move to the first field with an error;
 * native ScrollView does not follow that focus, so the box is measured against
 * the scroll content and moved with an instant `scrollTo` — no smooth scroll,
 * no pulse. Without a registered page, a failed measurement or a node that
 * cannot be measured, the callback still runs: focus must never be lost to a
 * scroll failure.
 */
export function scrollFieldIntoView(node: object, onDone: () => void): void {
  const page = pages[pages.length - 1] ?? null;
  const target = node as Partial<MeasurableNode>;
  const inner = page?.scrollView.getInnerViewRef?.() ?? null;
  if (page === null || inner === null || typeof target.measureLayout !== "function") {
    onDone();
    return;
  }

  let finished = false;
  // A host that never answers the measurement must not swallow focus: the old
  // behaviour always focused, so a late fallback keeps the keyboard reachable.
  const fallback = setTimeout(finish, 250);
  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(fallback);
    onDone();
  }

  try {
    target.measureLayout(
      inner,
      function placeField(_x, y, _width, height) {
        const viewport = page.viewportHeight();
        const margin = Math.max(0, (viewport - height) / 2);
        try {
          page.scrollView.scrollTo({ y: Math.max(0, y - margin), animated: false });
        } catch {
          // A scroll that cannot run must not swallow focus.
        }
        finish();
      },
      finish,
    );
  } catch {
    finish();
  }
}
