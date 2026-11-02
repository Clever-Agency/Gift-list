import { router, Stack } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { getBrandName } from "@/config/env";
import { useAuth } from "@/session/auth-context";
import { colors, spacing, textStyle } from "@/theme/tokens";
import { PrimaryButton } from "@/ui/primary-button";
import { AuthorLink } from "@/ui/author-link";

export default function HomeScreen() {
  const t = useTranslations("app");
  const common = useTranslations("common");
  const brand = getBrandName();
  const auth = useAuth();
  const [logoutError, setLogoutError] = useState<string | null>(null);

  useEffect(() => {
    if (auth.state.status === "anonymous") {
      router.replace({ pathname: "/login", params: { next: "/" } });
    }
  }, [auth.state.status]);

  if (auth.state.status !== "ready") return null;

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ title: t("home.pageTitle", { brand }) }} />
      <View style={styles.column}>
        <Text accessibilityRole="header" style={styles.logo}>
          {common("brandName", { brand })}
        </Text>
        <Text style={styles.title}>{t("home.title")}</Text>
        {logoutError ? (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite">
            {logoutError}
          </Text>
        ) : null}
        <PrimaryButton
          label={t("home.logout")}
          onPress={() => {
            void (async () => {
              setLogoutError(null);
              const result = await auth.signOut();
              if (!result.ok) setLogoutError(t("form.network"));
            })();
          }}
        />
        <View style={styles.spacer} />
        <AuthorLink />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  column: {
    flex: 1,
    width: "100%",
    maxWidth: spacing["max-form"],
    alignSelf: "center",
    paddingHorizontal: spacing["page-gutter"],
    paddingVertical: spacing["section-gap"],
    gap: spacing["grid-gap"],
  },
  logo: {
    ...textStyle("display-sm"),
    color: colors.primary,
    textAlign: "center",
  },
  title: {
    ...textStyle("heading"),
    color: colors.foreground,
  },
  spacer: {
    flex: 1,
  },
});
