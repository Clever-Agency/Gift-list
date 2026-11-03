import { Link, router, Stack } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import { useTranslations } from "use-intl";
import { getBrandName } from "@/config/env";
import { useAuth } from "@/session/auth-context";
import { colors, textStyle } from "@/theme/tokens";
import { AnonymousScreen } from "@/ui/anonymous-screen";
import { navLinkStyle } from "@/ui/nav-link";

// NOTE FOR UX: сама форма желания — Story 2.2; маршрут пока держит переход с «Добавить желание».

export default function NewGiftScreen() {
  const t = useTranslations("app");
  const brand = getBrandName();
  const auth = useAuth();

  useEffect(() => {
    if (auth.state.status === "anonymous") {
      router.replace({ pathname: "/login", params: { next: "/gifts/new" } });
    }
  }, [auth.state.status]);

  if (auth.state.status !== "ready") return null;

  return (
    <>
      <Stack.Screen options={{ title: t("newGift.pageTitle", { brand }) }} />
      <AnonymousScreen title={t("newGift.title")}>
        <Text style={styles.soon}>{t("newGift.soon")}</Text>
        <Link href="/" style={navLinkStyle} accessibilityRole="link">
          {t("newGift.back")}
        </Link>
      </AnonymousScreen>
    </>
  );
}

const styles = StyleSheet.create({
  soon: {
    ...textStyle("body"),
    color: colors["muted-foreground"],
  },
});
