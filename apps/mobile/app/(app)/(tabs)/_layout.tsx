import { AppShell, NavItem, TabBar } from "@gift-list/ui";
import { useTabsWithTriggers, TabList, TabSlot, TabTrigger } from "expo-router/ui";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { InviteBadgeProvider, useInviteBadge } from "@/navigation/invite-badge";
import { SidebarNav } from "@/navigation/sidebar-nav";
import { TAB_ITEMS, TAB_TRIGGERS } from "@/navigation/tab-items";

/**
 * The signed-in tabs (Story 6.2, UX-A13): «Вишлист · Поиск · Друзья · Брони ·
 * Профиль» in one order for both navigations. Compact and medium show the bottom
 * bar, expanded and wider the 264 px side menu; the bar stays mounted on every
 * width, so the tab routes never disappear on a resize (`AppShell` hides it with
 * a style only).
 *
 * `backBehavior: "firstRoute"` is the Android rule of the spec: «назад» on the
 * root of any tab opens «Вишлист», and «Вишлист» itself collapses the app. The
 * first route is `index` by definition (`sortRoutes` puts it first), so no anchor
 * is set here: on a tab navigator an anchor and `firstRoute` contradict each other
 * (expo-router warns about it), and the «Вишлист» route is already the first one.
 */

/**
 * The bar of the bottom tabs: five `TabTrigger`s, each a real `NavItem`.
 *
 * On the web `NavItem` is an `<a href>` and `TabTrigger asChild` only adds
 * `onPress` (and `isFocused` for the selected mark). A plain left click is
 * intercepted by expo-router itself: `useTabTrigger.handleOnPress` calls
 * `shouldHandleMouseEvent(event)`, which calls `event.preventDefault()` for a
 * left click without modifiers and then switches the tab, so the browser does not
 * reload the page. Modified clicks (new tab, new window) keep the anchor default.
 */
function TabsBar() {
  const nav = useTranslations("app.nav");
  const { count } = useInviteBadge();
  const friendsLabel =
    typeof count === "number" && count > 0 ? nav("friendsBadge", { count }) : undefined;

  return (
    <TabList asChild>
      <TabBar label={nav("sections")} testID="app-tab-bar">
        {TAB_ITEMS.map(function renderTab(item) {
          const secondary = item.badge ? friendsLabel : undefined;

          return (
            <TabTrigger key={item.key} name={item.name} href={item.href} asChild>
              <NavItem
                label={nav(item.tabLabel)}
                secondary={secondary}
                icon={<item.Icon />}
                badge={item.badge && count !== null ? count : undefined}
                selected={false}
                href={item.href}
                testID={`tab-${item.key}`}
              />
            </TabTrigger>
          );
        })}
      </TabBar>
    </TabList>
  );
}

TabsBar.displayName = "TabsBar";

type NavigationContentProps = {
  children: ReactNode;
};

/**
 * The navigator itself. `useTabsWithTriggers` is the hook form of the headless
 * `Tabs`: the component variant reads its triggers from its own children, but the
 * shell draws the bar below `main` (`AppShell.tabBar`), outside that tree, so the
 * routes are handed in explicitly — `TAB_TRIGGERS` is the same list the bar and
 * the side menu render.
 */
function TabsShell() {
  const web = useTranslations("web");
  const { count } = useInviteBadge();
  const { NavigationContent } = useTabsWithTriggers({
    triggers: TAB_TRIGGERS,
    backBehavior: "firstRoute",
  });
  // The hook memoises the component (`useComponent`), so its identity is stable
  // across renders and the tab state survives. Only the props type is narrowed to
  // the `children` the shell passes; rendering it through a local variable would
  // create a new component type on every render and remount the tabs.
  const Navigation = NavigationContent as (props: NavigationContentProps) => ReactNode;

  return (
    <Navigation>
      <AppShell
        testID="app-shell"
        skipLabel={web("skipToContent")}
        sidebar={<SidebarNav friendsCount={count} />}
        tabBar={<TabsBar />}
      >
        <TabSlot />
      </AppShell>
    </Navigation>
  );
}

TabsShell.displayName = "TabsShell";

/**
 * The badge provider sits above the tabs: one `GET /me/invites` per session feeds
 * both the «Друзья» tab and its side-menu item, and the «Друзья» screen refreshes
 * it after its own actions (`useInviteBadge`).
 */
export default function TabsLayout() {
  return (
    <InviteBadgeProvider>
      <TabsShell />
    </InviteBadgeProvider>
  );
}

TabsLayout.displayName = "TabsLayout";
