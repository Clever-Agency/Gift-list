import { Link, router, Stack, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { useTranslations } from "use-intl";
import { getBrandName } from "@/config/env";
import { useAuth } from "@/session/auth-context";
import { paramValue } from "@/session/return-path";
import { AnonymousScreen } from "@/ui/anonymous-screen";
import { navLinkStyle } from "@/ui/nav-link";

// NOTE FOR UX: цель возврата после регистрации по приглашению. Дружба и подтверждение — Story 4.7.

export default function InviteReturnScreen() {
  const t = useTranslations("app");
  const brand = getBrandName();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = paramValue(params.token) ?? "";
  const auth = useAuth();

  useEffect(() => {
    if (auth.state.status === "anonymous") {
      router.replace({ pathname: "/register", params: { next: `/invite/${token}` } });
    }
  }, [auth.state.status, token]);

  if (auth.state.status !== "ready") return null;

  return (
    <>
      <Stack.Screen options={{ title: t("invite.pageTitle", { brand }) }} />
      <AnonymousScreen title={t("invite.title")}>
        <Link href="/" style={navLinkStyle} accessibilityRole="link">
          {t("invite.toHome")}
        </Link>
      </AnonymousScreen>
    </>
  );
}
