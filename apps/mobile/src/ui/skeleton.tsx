import { StyleSheet, View } from "react-native";
import { colors, rounded, spacing } from "@/theme/tokens";

/** `DESIGN.md` → Мелкие элементы: skeleton blocks in `muted`, shaped like a card. */
export function WishCardSkeleton({ width }: { width: number }) {
  return (
    <View testID="wish-card-skeleton" style={[styles.card, { width }]}>
      <View style={[styles.line, styles.title]} />
      <View style={[styles.line, styles.price]} />
      <View style={[styles.line, styles.pill]} />
    </View>
  );
}

WishCardSkeleton.displayName = "WishCardSkeleton";

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: rounded.lg,
    padding: spacing["card-padding"],
    gap: spacing["grid-gap"] / 2,
  },
  line: {
    backgroundColor: colors.muted,
    borderRadius: rounded.sm,
  },
  title: {
    height: 22,
    width: "80%",
  },
  price: {
    height: 16,
    width: "40%",
  },
  pill: {
    height: spacing["pill-height"],
    width: "64%",
  },
});
