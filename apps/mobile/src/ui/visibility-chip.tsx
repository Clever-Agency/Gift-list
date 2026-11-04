import type { GiftCard } from "@gift-list/contracts";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import type { ComponentRef, Ref } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslations } from "use-intl";
import { colors, rounded, spacing, textStyle } from "@/theme/tokens";

/** Where the screen returns focus after the visibility layer closes. */
export type VisibilityChipRef = Ref<ComponentRef<typeof View>>;

/**
 * `DESIGN.md` → VisibilityChip: «Всем» / «Друзьям» / «Секрет».
 * The word carries the meaning; the icon and the border differ too, not only the colour.
 * Icons follow `DESIGN.md` → components `visibility-chip-*.icon` (globe / users / lock)
 * and are drawn with `expo-symbols`: the only icon set `apps/mobile` already ships
 * (`UX-A15` names `lucide-react-native`, which is not installed here).
 * The icon is decorative — screen readers get the word alone.
 *
 * `DESIGN.md` → VisibilityChip: on an `OPEN` wish the chip is a button that opens
 * the visibility picker (`aria-haspopup="dialog"`); on `RESERVED` / `CLOSED` it
 * only shows the value, so without `onPress` the root stays a plain `View`.
 */
export function VisibilityChip({
  visibility,
  onPress,
  chipRef,
}: {
  visibility: GiftCard["visibility"];
  onPress?: () => void;
  /** Ref to the root element, so the screen can put focus back on the chip. */
  chipRef?: VisibilityChipRef;
}) {
  const t = useTranslations("app.gift.visibility");
  const tLower = useTranslations("app.gift.visibilityLower");
  const tGift = useTranslations("app.gift");
  const tone = TONES[visibility];

  const content = (
    <>
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
    </>
  );

  if (!onPress) {
    return (
      <View ref={chipRef} style={[styles.chip, tone.chip]}>
        {content}
      </View>
    );
  }

  return (
    <Pressable
      ref={chipRef}
      accessibilityRole="button"
      accessibilityLabel={tGift("visibilityChipLabel", { value: tLower(visibility) })}
      // The chip opens a dialog. React Native types do not list the web-only ARIA
      // attribute yet, while react-native-web forwards it to the DOM.
      {...{ "aria-haspopup": "dialog" as const }}
      onPress={onPress}
      // The chip stays `chip-height` tall; the touch zone grows to `touch-target`.
      hitSlop={HIT_SLOP}
      style={({ pressed }) => [styles.chip, tone.chip, pressed ? styles.pressed : null]}
    >
      {content}
    </Pressable>
  );
}

VisibilityChip.displayName = "VisibilityChip";

/** `DESIGN.md` → VisibilityChip: the visual is 28 tall, the touch zone is 44. */
const HIT_SLOP = (spacing["touch-target"] - spacing["chip-height"]) / 2;

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
  // The same pressed feedback the other Pressables of the app give (DESIGN.md → App).
  pressed: {
    opacity: 0.9,
  },
  label: {
    ...textStyle("caption"),
  },
});
