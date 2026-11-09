import { router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { useTranslations } from "use-intl";
import { getBrandName } from "@/config/env";
import { useAuth } from "@/session/auth-context";
import { paramValue } from "@/session/return-path";
import { AnonymousScreen } from "@/ui/anonymous-screen";
import { NavLink } from "@/ui/nav-link";
import { SessionErrorScreen } from "@/ui/session-error-screen";
import { SessionLoadingScreen } from "@/ui/session-loading-screen";

// NOTE FOR UX: цель возврата после регистрации по приглашению. Дружба и подтверждение — Story 4.7.

export default function InviteReturnScreen() {
  const t = useTranslations("app");
  const brand = getBrandName();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = paramValue(params.token) ?? "";
  const auth = useAuth();

  useEffect(function redirectAnonymous() {
    if (auth.state.status === "anonymous") {
      router.replace({ pathname: "/register", params: { next: `/invite/${token}` } });
    }
  }, [auth.state.status, token]);

  if (auth.state.status === "error") {
    return <SessionErrorScreen size="form" onRetry={auth.retry} />;
  }

  if (auth.state.status !== "ready") return <SessionLoadingScreen size="form" />;

  return (
    <>
      <Stack.Screen options={{ title: t("invite.pageTitle", { brand }) }} />
      <AnonymousScreen title={t("invite.title")}>
        <NavLink href="/">
          {t("invite.toHome")}
        </NavLink>
      </AnonymousScreen>
    </>
  );
}

InviteReturnScreen.displayName = "InviteReturnScreen";
