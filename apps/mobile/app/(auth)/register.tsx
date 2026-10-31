import { Link, Stack } from "expo-router";
import { useTranslations } from "use-intl";
import { getBrandName } from "@/config/env";
import { AnonymousScreen } from "@/ui/anonymous-screen";
import { navLinkStyle } from "@/ui/nav-link";

export default function RegisterScreen() {
  const t = useTranslations("app");
  const brand = getBrandName();

  return (
    <>
      <Stack.Screen options={{ title: t("register.pageTitle", { brand }) }} />
      <AnonymousScreen title={t("register.title")}>
        <Link href="/login" style={navLinkStyle} accessibilityRole="link">
          {t("register.toLogin")}
        </Link>
        <Link href="/" style={navLinkStyle} accessibilityRole="link">
          {t("register.toHome")}
        </Link>
      </AnonymousScreen>
    </>
  );
}
