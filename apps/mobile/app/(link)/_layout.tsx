import { useThemeColor } from "@gift-list/ui";
import { Stack } from "expo-router";
import { AppFrame } from "@/navigation/app-frame";

/**
 * AD-30, D-50: `/wishlist/:token` is a signed-in screen of a link, but the same
 * address may open for a guest and shows the public list (§3 of the UI review:
 * «передача в вход»). It lives outside `(app)` on purpose: the `(app)` stack
 * keeps `(tabs)` as its anchor, and a guest who pressed «назад» on the public
 * wishlist would land on the signed-in «Вишлист» tab and be sent to login.
 * Without that anchor the guest leaves the screen exactly as before, while a
 * signed-in visitor still gets the one frame of the app (`AppFrame` decides from
 * the session). The URL is unchanged: a route group adds no path segment.
 *
 * `/invite/:token` stays in `(app)`: a guest is handed to registration at once,
 * so its anchor never shows a guest the signed-in tabs. Both providers of the
 * badge counts sit once above the root stack, so they need no repeat here.
 */
export default function LinkLayout() {
  const background = useThemeColor("background");

  return (
    <AppFrame>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: background } }}
      />
    </AppFrame>
  );
}

LinkLayout.displayName = "LinkLayout";
