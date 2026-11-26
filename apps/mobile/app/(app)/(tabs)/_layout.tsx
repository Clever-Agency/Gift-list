import { TabSlot, useTabsWithTriggers } from "expo-router/ui";
import type { ReactNode } from "react";
import { TABS_NAVIGATOR_OPTIONS } from "@/navigation/tab-items";

/**
 * The signed-in tabs (Story 6.2, UX-A13): the five routes «Вишлист · Поиск ·
 * Друзья · Брони · Профиль». This layout draws the routes only; the shell with
 * the side menu and the bottom bar lives above the whole `(app)` stack
 * (`app/(app)/_layout.tsx`, AD-30), so the bar is on every signed-in screen and
 * does not remount on a tab switch.
 *
 * The tabs navigator itself stays: it keeps each tab's own state and the Android
 * rule of `EXPERIENCE.md` → Навигация — `backBehavior: "firstRoute"` returns to
 * «Вишлист» (the first route, `/`) from the root of any tab; «Вишлист» itself
 * then collapses the app. `useTabsWithTriggers` takes the same `TAB_ITEMS` the
 * bar draws, so a section can never appear in one navigation and not the other.
 */
export default function TabsLayout() {
  const { NavigationContent } = useTabsWithTriggers(TABS_NAVIGATOR_OPTIONS);
  // The hook memoises the component, so its identity is stable across renders and
  // the tab state survives. Only the props type is narrowed to `children`; a local
  // component type would remount the tabs on every render.
  const Navigation = NavigationContent as (props: { children: ReactNode }) => ReactNode;

  return (
    <Navigation>
      <TabSlot />
    </Navigation>
  );
}

TabsLayout.displayName = "TabsLayout";
