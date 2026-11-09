import { NotFoundScreen } from "@/ui/not-found-screen";

/**
 * UI6: the styled answer to any unmatched route of the app. Expo Router renders
 * this file for a path that no screen owns; it is a 404 of the route, not the
 * neutral «вишлист недоступен» state of a well-formed link.
 */
export default function NotFoundRoute() {
  return <NotFoundScreen />;
}

NotFoundRoute.displayName = "NotFoundRoute";
