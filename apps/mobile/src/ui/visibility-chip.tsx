import type { GiftCard } from "@gift-list/contracts";
import { StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { colors, rounded, spacing, textStyle } from "@/theme/tokens";

/**
 * Owner-only chip (`DESIGN.md` → VisibilityChip): «Всем» / «Друзьям» / «Секрет».
 * The word carries the meaning; the border differs too, not only the colour.
 * NOTE FOR UX: lucide icons (UX-A15) are not wired into `apps/mobile` yet, so the
 * chip has no icon slot. Choice and saving are Story 2.3; here it only shows the value.
 */
export function VisibilityChip({ visibility }: { visibility: GiftCard["visibility"] }) {
  const t = useTranslations("app.gift.visibility");
  const tone = TONES[visibility];

  return (
    <View style={[styles.chip, tone.chip]}>
      <Text style={[styles.label, tone.text]}>{t(visibility)}</Text>
    </View>
  );
}

const TONES = {
  PUBLIC: {
    chip: { backgroundColor: colors.surface, borderStyle: "solid" as const },
    text: { color: colors.primary },
  },
  FRIENDS: {
    chip: { backgroundColor: colors.muted, borderStyle: "solid" as const },
    text: { color: colors.foreground },
  },
  SECRET: {
    chip: { backgroundColor: "transparent", borderStyle: "dashed" as const },
    text: { color: colors["muted-foreground"] },
  },
} as const;

const styles = StyleSheet.create({
  chip: {
    alignSelf: "flex-start",
    minHeight: spacing["chip-height"],
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors["border-strong"],
    borderRadius: rounded.sm,
    paddingHorizontal: spacing["grid-gap"] / 2,
  },
  label: {
    ...textStyle("caption"),
  },
});
