import {
  ERROR_CODES,
  compareForSort,
  errorCodeSchema,
  formatDate,
  formatPrice,
} from "@gift-list/contracts";
import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocale, useTranslations } from "use-intl";
import { getApiBaseUrl, getBrandName } from "@/config/env";
import { colors, spacing, textStyle } from "@/theme/tokens";
import { AuthorLink } from "@/ui/author-link";
import { navLinkStyle } from "@/ui/nav-link";

const WISH_COUNTS = [1, 3, 5, 21] as const;
const SORT_NAMES = ["Яна", "Алёна", "Алена"] as const;

export default function HomeScreen() {
  const t = useTranslations("app");
  const common = useTranslations("common");
  const locale = useLocale();
  const brand = getBrandName();
  const wishes = WISH_COUNTS.map((count) => t("smoke.wishes", { count })).join(" · ");
  const names = [...SORT_NAMES].sort((left, right) => compareForSort(locale, left, right));
  const parsed = errorCodeSchema.safeParse(ERROR_CODES[0]);

  return (
    <SafeAreaView style={styles.screen}>
      <Stack.Screen options={{ title: t("home.pageTitle", { brand }) }} />
      <View style={styles.column}>
        <Text accessibilityRole="header" style={styles.logo}>
          {common("brandName", { brand })}
        </Text>
        <Text style={styles.title}>{t("home.title")}</Text>
        <Text style={styles.body}>{wishes}</Text>
        <Text style={styles.body}>
          {t("smoke.prices", {
            byn: formatPrice(1050, "BYN", locale),
            rub: formatPrice(250000, "RUB", locale),
          })}
        </Text>
        <Text style={styles.body}>{t("smoke.date", { date: formatDate("2026-10-31", locale) })}</Text>
        <Text style={styles.body}>
          {t("smoke.names", { a: names[0], b: names[1], c: names[2] })}
        </Text>
        <Text style={styles.caption}>{parsed.success ? t("contractsOk") : ""}</Text>
        <Text style={styles.caption}>
          {getApiBaseUrl().length > 0 ? common("apiSet") : common("apiUnset")}
        </Text>
        <Link href="/login" style={navLinkStyle} accessibilityRole="link">
          {t("home.toLogin")}
        </Link>
        <Link href="/register" style={navLinkStyle} accessibilityRole="link">
          {t("home.toRegister")}
        </Link>
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
  body: {
    ...textStyle("body"),
    color: colors.foreground,
  },
  caption: {
    ...textStyle("caption"),
    color: colors["muted-foreground"],
  },
  spacer: {
    flex: 1,
  },
});
