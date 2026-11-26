import { useThemeColor } from "@gift-list/ui";
import { Stack } from "expo-router";
import { AppFrame } from "@/navigation/app-frame";

/**
 * The signed-in part of the app (Story 6.2, AD-30): one `AppShell` — the side
 * menu on expanded+ and the bottom tabs on compact/medium — around the **whole**
 * `Stack`, not only around the tabs. The nested screens (`/settings`,
 * `/notifications`, `/gifts/:id`, the wish forms, `/u/:nick`) therefore keep the
 * navigation, and the forms with the pinned «Куплю сам» sit above the bottom bar,
 * never under it. `/invite/:token` is here too: a guest is handed to registration
 * at once, and a signed-in visitor gets the `(tabs)` anchor on «назад». The public
 * wishlist of a link stays in `(link)` — a guest can read it without a session,
 * and it must not get this stack's `(tabs)` anchor (see that layout).
 *
 * The tab routes themselves stay in `(tabs)`, a real tabs navigator: the shell
 * only draws the bar above the stack. The active section is derived from the
 * path and the last root tab (`ActiveSectionProvider`).
 *
 * The anchor keeps `(tabs)` under a nested screen opened from a link, so the
 * system «назад» of `/settings`, `/gifts/:id` or `/u/:nick` returns to the
 * section root instead of leaving the app.
 */
export const unstable_settings = { anchor: "(tabs)" };

export default function AppLayout() {
  const background = useThemeColor("background");

  return (
    <AppFrame>
      <Stack
        screenOptions={{ headerShown: false, contentStyle: { backgroundColor: background } }}
      />
    </AppFrame>
  );
}

AppLayout.displayName = "AppLayout";
