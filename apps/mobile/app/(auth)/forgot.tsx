import { Link, Stack, useLocalSearchParams } from "expo-router";
import { useTranslations } from "use-intl";
import { getBrandName } from "@/config/env";
import { paramValue, returnPath } from "@/session/return-path";
import { AnonymousScreen } from "@/ui/anonymous-screen";
import { navLinkStyle } from "@/ui/nav-link";

// NOTE FOR UX: форма нового пароля и письмо — Story 1.7. Здесь только вход в этот экран.

export default function ForgotScreen() {
  const t = useTranslations("app");
  const brand = getBrandName();
  const params = useLocalSearchParams<{ next?: string; email?: string }>();
  const next = returnPath(params.next);
  const email = paramValue(params.email);

  return (
    <>
      <Stack.Screen options={{ title: t("forgot.pageTitle", { brand }) }} />
      <AnonymousScreen title={t("forgot.title")}>
        <Link
          href={{
            pathname: "/login",
            params: { ...(next !== "/" ? { next } : {}), ...(email ? { email } : {}) },
          }}
          style={navLinkStyle}
          accessibilityRole="link"
        >
          {t("forgot.toLogin")}
        </Link>
      </AnonymousScreen>
    </>
  );
}
