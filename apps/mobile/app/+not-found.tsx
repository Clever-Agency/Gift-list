import { AppFrame } from "@/navigation/app-frame";
import { NotFoundScreen } from "@/ui/not-found-screen";

/**
 * UI6: the styled answer to any unmatched route of the app. Expo Router renders
 * this file for a path that no screen owns; it is a 404 of the route, not the
 * neutral «вишлист недоступен» state of a well-formed link.
 *
 * AD-30: a signed-in visitor keeps the shell — the side menu and the bottom bar
 * have no selected section here — while an anonymous visitor gets the page
 * without navigation (`AppFrame` decides from the session).
 */
export default function NotFoundRoute() {
  return (
    <AppFrame>
      <NotFoundScreen />
    </AppFrame>
  );
}

NotFoundRoute.displayName = "NotFoundRoute";
