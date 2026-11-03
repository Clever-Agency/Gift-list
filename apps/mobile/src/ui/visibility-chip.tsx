import type { GiftCard } from "@gift-list/contracts";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import { StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { colors, rounded, spacing, textStyle } from "@/theme/tokens";

/**
 * Owner-only chip (`DESIGN.md` → VisibilityChip): «Всем» / «Друзьям» / «Секрет».
 * The word carries the meaning; the icon and the border differ too, not only the colour.
 * Icons follow `DESIGN.md` → components `visibility-chip-*.icon` (globe / users / lock)
 * and are drawn with `expo-symbols`: the only icon set `apps/mobile` already ships
 * (`UX-A15` names `lucide-react-native`, which is not installed here).
 * The icon is decorative — screen readers get the word alone.
 * Choice and saving are Story 2.3; here it only shows the value.
 */
export function VisibilityChip({ visibility }: { visibility: GiftCard["visibility"] }) {
  const t = useTranslations("app.gift.visibility");
  const tone = TONES[visibility];

  return (
    <View style={[styles.chip, tone.chip]}>
      <SymbolView
        name={ICONS[visibility]}
        size={spacing["icon-small"]}
        tintColor={tone.text.color}
        // Decorative: the label next to it is the accessible name.
        aria-hidden
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <Text style={[styles.label, tone.text]}>{t(visibility)}</Text>
    </View>
  );
}

/**
 * `DESIGN.md` → components: `visibility-chip-public.icon: globe`,
 * `visibility-chip-friends.icon: users`, `visibility-chip-secret.icon: lock`.
 * The names translate to the Material Symbols equivalents used on Android and web.
 */
const ICONS = {
  PUBLIC: { ios: "globe", android: "public", web: "public" },
  FRIENDS: { ios: "person.2", android: "group", web: "group" },
  SECRET: { ios: "lock", android: "lock", web: "lock" },
} as const satisfies Record<GiftCard["visibility"], SymbolViewProps["name"]>;

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
    flexDirection: "row",
    alignItems: "center",
    gap: spacing["grid-gap"] / 4,
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
