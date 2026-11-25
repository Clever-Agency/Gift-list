import {
  Column,
  Heading,
  PageContainer,
  PageScroll,
  SafeArea,
  Screen,
  Text,
  XStack,
  YStack,
} from "@gift-list/ui";
import { router, Stack } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "use-intl";
import { NotificationBell } from "@/ui/notification-bell";
import { getBrandName } from "@/config/env";
import { profileRoute } from "@/profile/profile-route";
import { useAuth } from "@/session/auth-context";
import { ProfileMenu } from "@/ui/profile-menu";
import { SessionErrorScreen } from "@/ui/session-error-screen";
import { SessionLoadingScreen } from "@/ui/session-loading-screen";
import { SiteFooter } from "@/ui/site-footer";
import { ToastHost } from "@/ui/toast";

/**
 * «Профиль» (Story 6.2, `DESIGN.md` → Навигация приложения): the fifth section of
 * the shell — a short menu instead of a screen with data. It guards the session
 * like «Настройки» (`next=/profile`), so a direct anonymous visit lands on the
 * login screen and comes back here.
 *
 * The rows live in `ProfileMenu`: «Мой профиль» (`/u/{nick}`), «Настройки»
 * (`/settings`), «Написать автору» and «Выйти» — the last one moved here from the
 * temporary footer of «Мой вишлист». «Подборки» arrive with Story 10.1, the full
 * user menu of the side bar with Story 6.3.
 */
export default function MyProfileScreen() {
  const auth = useAuth();
  const t = useTranslations("app");
  const nav = useTranslations("app.nav");
  const profile = useTranslations("app.profile");
  const common = useTranslations("common");
  const brand = getBrandName();
  const [toast, setToast] = useState<{ message: string; tone: "info" | "error" } | null>(null);
  // One sign-out request at a time: the row is disabled while it is in flight.
  const [signingOut, setSigningOut] = useState(false);
  const inFlight = useRef(false);

  useEffect(
    function redirectAnonymous() {
      if (auth.state.status === "anonymous") {
        // The login screen owns the «Сессия закончилась» toast: it outlives this
        // screen. The screen reads no data of its own, so it never names the reason:
        // the guard only sends the anonymous visitor back here after the login.
        router.replace({ pathname: "/login", params: { next: "/profile" } });
      }
    },
    [auth.state.status],
  );

  function openSettings() {
    router.push("/settings");
  }

  function openOwnProfile() {
    if (auth.state.status !== "ready") return;
    const route = profileRoute(auth.state.user.nick);
    if (route === null) return;
    router.push({ pathname: "/u/[nick]", params: { nick: route.nick } });
  }

  function dismissToast() {
    setToast(null);
  }

  /**
   * «Выйти»: the session is cleared by `AuthContext`, then the guard above opens
   * the login screen with `next=/profile`. A failed request keeps the person here
   * and reports the one network sentence (`EXPERIENCE.md` → «Нет сети»).
   */
  async function signOut() {
    if (inFlight.current) return;
    inFlight.current = true;
    setSigningOut(true);
    const result = await auth.signOut();
    inFlight.current = false;
    setSigningOut(false);
    if (!result.ok) setToast({ message: t("form.network"), tone: "error" });
  }

  function handleSignOut() {
    void signOut();
  }

  if (auth.state.status === "error") {
    return <SessionErrorScreen onRetry={auth.retry} />;
  }

  if (auth.state.status !== "ready") {
    return <SessionLoadingScreen />;
  }

  return (
    <Screen>
      {/* A tab root: the bottom bar holds the home indicator (spec 6.2). */}
      <SafeArea bottom={false}>
        <Stack.Screen options={{ title: profile("pageTitle", { brand }) }} />
        <PageScroll testID="profile-page">
          <PageContainer>
            <Column
              size="content"
              flexGrow={1}
              paddingHorizontal="$page-gutter medium:$page-gutter-lg"
              paddingTop="$page-gutter"
              gap="$2"
            >
              <Text kind="display-sm" tone="primary" textAlign="center">
                {common("brandName", { brand })}
              </Text>
              <XStack justifyContent="space-between" alignItems="center">
                <Heading level={1}>{nav("profile")}</Heading>
                <NotificationBell />
              </XStack>
              <YStack flexGrow={1} paddingTop="$2" paddingBottom="$section-gap">
                <ProfileMenu
                  onOpenProfile={openOwnProfile}
                  onOpenSettings={openSettings}
                  onSignOut={handleSignOut}
                  signingOut={signingOut}
                />
              </YStack>
              <SiteFooter />
            </Column>
          </PageContainer>
        </PageScroll>
        {toast ? (
          <ToastHost message={toast.message} tone={toast.tone} onDismiss={dismissToast} />
        ) : null}
      </SafeArea>
    </Screen>
  );
}

MyProfileScreen.displayName = "MyProfileScreen";
