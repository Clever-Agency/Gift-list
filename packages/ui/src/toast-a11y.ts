/**
 * Accessibility of the toast, web half.
 *
 * The browser announces the card itself: `role` (`status` / `alert`) plus
 * `aria-live` is the whole web story (`DESIGN.md` → Доступность → ToastHost).
 * The phone needs the two React Native props of `toast-a11y.native.ts`, so the
 * pair keeps the platform split out of the component: web returns the live
 * region attribute the DOM reads, native the phone one.
 *
 * `useToastAnnouncement` is a no-op here: a live region already speaks, and a
 * second hand-made announcement would repeat the text twice.
 */
export function toastA11yProps(assertive: boolean) {
  return { "aria-live": assertive ? "assertive" : "polite" } as const;
}

/** Web: the live region of the card speaks; the text is the phone's argument. */
export function useToastAnnouncement(message: string) {
  void message;
}
