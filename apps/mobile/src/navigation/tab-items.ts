import { CalendarCheck, Heart, Search, User, Users } from "@gift-list/ui";
import type { ComponentType } from "react";

/**
 * The five sections of `UX-A13` and `DESIGN.md` → «Навигация приложения», in
 * their one order: «Вишлист · Поиск · Друзья · Брони · Профиль». The bottom tabs
 * show the short captions, the side menu the full names; both read the same list,
 * so a section can never appear in one navigation and not in the other.
 */
export type TabKey = "wishlist" | "search" | "friends" | "reservations" | "profile";

/** The label keys of `app.nav`: the tab caption and the side-menu name. */
type TabLabelKey = "wishlistTab" | "search" | "friends" | "reservationsTab" | "profile";
type MenuLabelKey = "wishlist" | "search" | "friends" | "reservations" | "profile";

export type TabItem = {
  key: TabKey;
  /** The `TabTrigger` name: the key of the trigger, not the route file name. */
  name: TabKey;
  /** The one address of the section; the browser keeps it per tab (AD-26). */
  href: "/" | "/search" | "/friends" | "/reservations" | "/profile";
  /** The section glyph, 24 px in both navigations. */
  Icon: ComponentType<{ color?: string }>;
  /** The caption under the icon of the bottom tab. */
  tabLabel: TabLabelKey;
  /** The full name of the side-menu item. */
  menuLabel: MenuLabelKey;
  /** The section carries the incoming friend-request count (`app.nav.friendsBadge`). */
  badge: boolean;
};

/**
 * The closed list of sections: the first item is `index` (`/`), so Android «назад»
 * on the root of any tab first reaches «Вишлист» (`backBehavior: "firstRoute"`) and
 * «Вишлист» itself collapses the app. Nothing is added here without a section that
 * exists: «Уведомления» (Story 6.1) and «Подборки» (Story 10.1) stay out.
 */
export const TAB_ITEMS: readonly TabItem[] = [
  {
    key: "wishlist",
    name: "wishlist",
    href: "/",
    Icon: Heart,
    tabLabel: "wishlistTab",
    menuLabel: "wishlist",
    badge: false,
  },
  {
    key: "search",
    name: "search",
    href: "/search",
    Icon: Search,
    tabLabel: "search",
    menuLabel: "search",
    badge: false,
  },
  {
    key: "friends",
    name: "friends",
    href: "/friends",
    Icon: Users,
    tabLabel: "friends",
    menuLabel: "friends",
    badge: true,
  },
  {
    key: "reservations",
    name: "reservations",
    href: "/reservations",
    Icon: CalendarCheck,
    tabLabel: "reservationsTab",
    menuLabel: "reservations",
    badge: false,
  },
  {
    key: "profile",
    name: "profile",
    href: "/profile",
    Icon: User,
    tabLabel: "profile",
    menuLabel: "profile",
    badge: false,
  },
];

/**
 * The same list as the headless `Tabs` sees it: `useTabsWithTriggers` takes the
 * routes explicitly, because the bottom bar of the shell does not live among the
 * children of `Tabs` and the component variant only parses triggers from there.
 * The first entry is the first route, which `backBehavior: "firstRoute"` needs.
 */
export const TAB_TRIGGERS = TAB_ITEMS.map(function toTrigger(item) {
  return { type: "internal" as const, name: item.name, href: item.href };
});

/**
 * The one configuration of the tabs navigator (`(tabs)/_layout.tsx`). `firstRoute`
 * is the Android rule of `EXPERIENCE.md` → Навигация: «назад» on the root of any
 * tab first goes to «Вишлист» (the first entry, `/`), and «Вишлист» itself then
 * collapses the app.
 */
export const TABS_NAVIGATOR_OPTIONS = {
  triggers: TAB_TRIGGERS,
  backBehavior: "firstRoute" as const,
};

/** The section a path belongs to; only the exact root counts, as in the side menu. */
export function sectionOf(pathname: string): TabItem | undefined {
  const path = pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  return TAB_ITEMS.find(function sameHref(item) {
    return item.href === path;
  });
}
