/**
 * Story 6.2 (E) / AD-26: the App Link `/l/:token` opens the public wishlist under
 * its own path. The route re-exports the `/wishlist/:token` screen instead of
 * redirecting: a redirect replaces the history entry, so «назад» from the list
 * would leave the app instead of returning to the tabs (`Open Questions` 9).
 *
 * On the web `/l/*` stays a Next page (`spa-paths.ts`), so this double only runs
 * inside the app.
 */
export { default } from "../(link)/wishlist/[token]";
