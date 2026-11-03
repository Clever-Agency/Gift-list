import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, textStyle } from "@/theme/tokens";

/** `DESIGN.md` → EmptyState: display title, one body line, at most one primary CTA. */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
    maxWidth: spacing["max-form"],
    alignSelf: "center",
    alignItems: "center",
    paddingVertical: spacing["section-gap"],
    gap: spacing["grid-gap"],
  },
  title: {
    ...textStyle("display-sm"),
    color: colors.foreground,
    textAlign: "center",
  },
  body: {
    ...textStyle("body"),
    color: colors["muted-foreground"],
    textAlign: "center",
  },
  action: {
    width: "100%",
  },
});
