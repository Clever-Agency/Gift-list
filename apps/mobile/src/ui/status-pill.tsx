import type { GiftCard } from "@gift-list/contracts";
import { StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { colors, rounded, spacing, textStyle } from "@/theme/tokens";

/**
 * AD-12 status, always spelled out (`DESIGN.md` → StatusPill). Not a button.
 * `DESIGN.md` → components: open and closed sit on `muted`, reserved on its own tint.
 */
export function StatusPill({ status }: { status: GiftCard["status"] }) {
  const t = useTranslations("app.gift.status");
  const tone = TONES[status];

  return (
    <View style={[styles.pill, tone.background]}>
      <Text style={[styles.label, tone.text]}>{t(status)}</Text>
    </View>
  );
}

const TONES = {
  OPEN: { background: { backgroundColor: colors.muted }, text: { color: colors["status-open"] } },
  RESERVED: {
    background: { backgroundColor: colors["status-reserved-bg"] },
    text: { color: colors["status-reserved"] },
  },
  CLOSED: { background: { backgroundColor: colors.muted }, text: { color: colors["status-closed"] } },
} as const;

const styles = StyleSheet.create({
  pill: {
    alignSelf: "flex-start",
    minHeight: spacing["pill-height"],
    justifyContent: "center",
    borderRadius: rounded.full,
    // `DESIGN.md` → StatusPill: padding 0 10. `spacing` has no 10; the closest token
    // is `grid-gap / 2` (8), the same horizontal inset as `VisibilityChip`.
    paddingHorizontal: spacing["grid-gap"] / 2,
  },
  label: {
    ...textStyle("caption"),
  },
});
