import { NavItem, TabBar } from "@gift-list/ui";
import { router } from "expo-router";
import { Platform } from "react-native";
import { useTranslations } from "use-intl";
import { useActiveSection } from "./active-section";
import { pressLink } from "./link-press";
import { TAB_ITEMS } from "./tab-items";

export type AppTabBarProps = {
  /**
   * Incoming friend requests for the badge of «Друзья»; `null` and `0` draw no
   * badge. The count comes from `useInviteBadge()` in the app frame.
   */
  friendsCount?: number | null;
  testID?: string;
};

/**
 * `DESIGN.md` → Навигация приложения: the bottom bar of compact and medium, on
 * every signed-in screen (D-50, AD-30). It repeats the five sections of UX-A13
 * and marks the current one from the path — `useActiveSection`, not
 * `TabTrigger`: the bar now lives above the whole `(app)` stack, outside the
 * tabs navigator, where a `TabTrigger` does not work.
 *
 * The browser item is a real `<a href>` and a plain left click goes through the
 * router (`pressLink`), while a modified click still opens a new tab; the phone
 * navigates from the press. The routes themselves stay in the tabs navigator
 * (`(tabs)/_layout.tsx`), so its per-tab state and `backBehavior` are untouched.
 */
export function AppTabBar({ friendsCount, testID = "app-tab-bar" }: AppTabBarProps) {
  const nav = useTranslations("app.nav");
  const active = useActiveSection();
  const count =
    typeof friendsCount === "number" && friendsCount > 0 ? friendsCount : undefined;
  const friendsLabel = count === undefined ? undefined : nav("friendsBadge", { count });

  function openSection(href: string) {
    router.navigate(href);
  }

  return (
    <TabBar label={nav("sections")} testID={testID}>
      {TAB_ITEMS.map(function renderSection(section) {
        const secondary = section.badge ? friendsLabel : undefined;

        return (
          <NavItem
            key={section.key}
            label={nav(section.tabLabel)}
            secondary={secondary}
            icon={<section.Icon />}
            badge={section.badge ? count : undefined}
            selected={active === section.key}
            href={section.href}
            onPress={
              Platform.OS === "web"
                ? pressLink(section.href)
                : function open() {
                    openSection(section.href);
                  }
            }
            testID={`tab-${section.key}`}
          />
        );
      })}
    </TabBar>
  );
}

AppTabBar.displayName = "AppTabBar";
