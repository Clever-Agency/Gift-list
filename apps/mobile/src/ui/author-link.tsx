import * as Linking from "expo-linking";
import { Pressable, StyleSheet, Text } from "react-native";
import { useTranslations } from "use-intl";
import { getAuthorUrl } from "@/config/env";
import { colors, spacing, textStyle } from "@/theme/tokens";

export function AuthorLink() {
  const t = useTranslations("common");
  const label = t("writeToAuthor");
  const url = getAuthorUrl();

  if (!url) {
    // NOTE FOR UX: адрес «Написать автору» не задан.
    return (
      <Text accessibilityRole="text" style={styles.label}>
        {label}
      </Text>
    );
  }

  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => {
        void Linking.openURL(url).catch(() => {});
      }}
      style={styles.hit}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hit: {
    minHeight: spacing["touch-target"],
    minWidth: spacing["touch-target"],
    justifyContent: "center",
  },
  label: {
    color: colors.primary,
    ...textStyle("button"),
  },
});
