import { AppShell } from "@gift-list/ui";
import type { ReactNode } from "react";
import { useTranslations } from "use-intl";
import { useAuth } from "@/session/auth-context";
import { AppTabBar } from "./app-tab-bar";
import { useInviteBadgeOptional } from "./invite-badge";
import { SidebarNav } from "./sidebar-nav";

export type AppFrameProps = {
  /** The stack of signed-in screens or the one not-found page. */
  children?: ReactNode;
};

/**
 * AD-30: the one frame of the signed-in app — `AppShell`, the side menu
 * (`SidebarNav`) and the bottom bar (`AppTabBar`) around the whole `(app)` stack.
 * The screens that are opened without a session, such as the public wishlist of
 * a link, keep the same frame but get no navigation: the shell then reserves no
 * bar height either, so the page keeps its own bottom safe area.
 *
 * The frame reads the invite count through the optional hook, so the root
 * «не найдено» can use it outside `InviteBadgeProvider` and simply shows no
 * badge.
 */
export function AppFrame({ children }: AppFrameProps) {
  const common = useTranslations("common");
  const auth = useAuth();
  const invites = useInviteBadgeOptional();
  // `loading` is not a signed-in screen yet, so a guest who opens the public
  // wishlist never sees a flash of the navigation; `error` keeps it, because a
  // failed session read is not a sign-out.
  const signedIn = auth.state.status === "ready" || auth.state.status === "error";
  const friendsCount = invites?.count ?? null;

  return (
    <AppShell
      testID="app-shell"
      skipLabel={common("skipToContent")}
      sidebar={signedIn ? <SidebarNav friendsCount={friendsCount} /> : undefined}
      tabBar={signedIn ? <AppTabBar friendsCount={friendsCount} /> : undefined}
    >
      {children}
    </AppShell>
  );
}

AppFrame.displayName = "AppFrame";
