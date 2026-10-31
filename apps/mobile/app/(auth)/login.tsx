import { Link, Stack } from "expo-router";
import { useTranslations } from "use-intl";
import { getBrandName } from "@/config/env";
import { AnonymousScreen } from "@/ui/anonymous-screen";
import { navLinkStyle } from "@/ui/nav-link";

export default function LoginScreen() {
  const t = useTranslations("app");
  const brand = getBrandName();

  return (
    <>
      <Stack.Screen options={{ title: t("login.pageTitle", { brand }) }} />
      <AnonymousScreen title={t("login.title")}>
        <Link href="/register" style={navLinkStyle} accessibilityRole="link">
          {t("login.toRegister")}
        </Link>
        <Link href="/" style={navLinkStyle} accessibilityRole="link">
          {t("login.toHome")}
        </Link>
      </AnonymousScreen>
    </>
  );
}
