import type { ReactNode } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTranslations } from "use-intl";
import { getBrandName } from "@/config/env";
import { colors, spacing, textStyle } from "@/theme/tokens";
import { AuthorLink } from "@/ui/author-link";

export function AnonymousScreen({ title, children }: { title: string; children?: ReactNode }) {
  const t = useTranslations("common");

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.column} keyboardShouldPersistTaps="handled">
        <Text accessibilityRole="header" style={styles.logo}>
          {t("brandName", { brand: getBrandName() })}
        </Text>
        <View style={styles.block}>
          <Text style={styles.title}>{title}</Text>
          {children}
        </View>
        <View style={styles.spacer} />
        <AuthorLink />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  column: {
    flexGrow: 1,
    width: "100%",
    maxWidth: spacing["max-form"],
    alignSelf: "center",
    paddingHorizontal: spacing["page-gutter"],
    paddingVertical: spacing["page-gutter"],
  },
  logo: {
    ...textStyle("display-sm"),
    color: colors.primary,
    textAlign: "center",
  },
  block: {
    width: "100%",
    maxWidth: spacing["max-form"],
    marginTop: spacing["section-gap"],
    gap: spacing["grid-gap"],
  },
  title: {
    ...textStyle("heading"),
    color: colors.foreground,
  },
  spacer: {
    flex: 1,
  },
});
