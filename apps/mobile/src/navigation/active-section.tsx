import { usePathname } from "expo-router";
import { createContext, useContext, useEffect, useRef, type ReactNode } from "react";
import { sectionOf, type TabKey } from "./tab-items";

/**
 * AD-30, D-50: navigation is on every signed-in screen, and the selected item is
 * the section the visitor came from. A root tab is its own section. A nested
 * screen (`/settings`, `/gifts/:id`, `/u/:nick`, `/wishlist/:token`, …) keeps
 * the last root tab that was open; a cold start on such a screen has no such
 * root, so the route itself decides:
 *
 * - `/gifts/*` and `/wishlist/*` → «Вишлист»;
 * - `/u/*` and `/invite/*` → «Друзья»;
 * - `/settings` → «Профиль»;
 * - `/notifications` → no bottom tab (the side menu marks its own item).
 *
 * The origin lives in a ref, not in state: it only changes when a root tab is
 * entered, and the consumers already re-render on `usePathname()`.
 */
const NOTIFICATIONS_PATH = "/notifications";

type NestedSection = { prefix: string; key: TabKey };

const NESTED_SECTIONS: readonly NestedSection[] = [
  { prefix: "/gifts", key: "wishlist" },
  { prefix: "/wishlist", key: "wishlist" },
  { prefix: "/u", key: "friends" },
  { prefix: "/invite", key: "friends" },
  { prefix: "/settings", key: "profile" },
];

/** `/notifications` and its subpaths belong to the side-menu item only. */
export function isNotificationsPath(pathname: string): boolean {
  const path = trimTrailingSlash(pathname);
  return path === NOTIFICATIONS_PATH || path.startsWith(`${NOTIFICATIONS_PATH}/`);
}

/** The section a nested route belongs to when there is no remembered origin. */
export function sectionForNestedPath(pathname: string): TabKey | undefined {
  const path = trimTrailingSlash(pathname);
  return NESTED_SECTIONS.find(function matchesPrefix(item) {
    return path === item.prefix || path.startsWith(`${item.prefix}/`);
  })?.key;
}

function trimTrailingSlash(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
}

type LastSection = { current: TabKey | null };

const LastSectionContext = createContext<LastSection | null>(null);

/**
 * Remembers the last root tab of the signed-in stack. Mounted once, above the
 * whole `(app)` stack, so a nested screen does not lose the origin on the way.
 */
export function ActiveSectionProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const root = sectionOf(pathname)?.key ?? null;
  const last = useRef<TabKey | null>(root);

  useEffect(
    function rememberRootSection() {
      if (root) last.current = root;
    },
    [root],
  );

  return <LastSectionContext.Provider value={last}>{children}</LastSectionContext.Provider>;
}

ActiveSectionProvider.displayName = "ActiveSectionProvider";

/**
 * The section to mark as current: the root tab, the remembered root on a nested
 * screen, or the route's own fallback on a cold start. `undefined` means that no
 * bottom tab is selected.
 */
export function useActiveSection(): TabKey | undefined {
  const pathname = usePathname();
  const last = useContext(LastSectionContext);

  // «Уведомления» live in the side menu only: on compact and medium no tab is
  // selected, even when the visitor opened them from a tab (D-50).
  if (isNotificationsPath(pathname)) return undefined;

  const root = sectionOf(pathname);
  if (root) return root.key;

  return last?.current ?? sectionForNestedPath(pathname);
}
