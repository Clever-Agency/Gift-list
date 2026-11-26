/**
 * Story 6.2 (E) / AD-21: the App Link `/i/:token` opens the invite under its own
 * path. The route re-exports the `/invite/:token` screen instead of redirecting:
 * a redirect replaces the history entry, so «назад» would leave the app instead
 * of returning to the tabs (`Open Questions` 9).
 *
 * On the web `/i/*` stays a Next page (`spa-paths.ts`), so this double only runs
 * inside the app.
 */
export { default } from "../(app)/invite/[token]";
