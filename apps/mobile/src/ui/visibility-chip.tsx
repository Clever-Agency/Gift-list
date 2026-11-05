import type { GiftCard } from "@gift-list/contracts";
import {
  VisibilityChip as UiVisibilityChip,
  spacing,
  visibilityChipColors,
  type VisibilityTone,
} from "@gift-list/ui";
import { SymbolView, type SymbolViewProps } from "expo-symbols";
import type { ComponentRef, Ref } from "react";
import { useTranslations } from "use-intl";

/** Where the screen returns focus after the visibility layer closes. */
export type VisibilityChipRef = Ref<ComponentRef<typeof UiVisibilityChip>>;

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
 * only shows the value, so without `onPress` it is not a control. The chip itself is
 * `VisibilityChip` of `@gift-list/ui`; this wrapper supplies the catalogue texts and
 * the icon.
 */
export function VisibilityChip({
  visibility,
  onPress,
  chipRef,
}: {
  visibility: GiftCard["visibility"];
  onPress?: () => void;
  /** Ref to the pressable root, so the screen can put focus back on the chip. */
  chipRef?: VisibilityChipRef;
}) {
  const t = useTranslations("app.gift.visibility");
  const tLower = useTranslations("app.gift.visibilityLower");
  const tGift = useTranslations("app.gift");
  const tone = TONES[visibility];

  return (
    <UiVisibilityChip
      ref={chipRef}
      tone={tone}
      label={t(visibility)}
      accessibilityLabel={tGift("visibilityChipLabel", { value: tLower(visibility) })}
      onPress={onPress}
      icon={
        <SymbolView
          name={ICONS[visibility]}
          size={spacing["icon-small"]}
          tintColor={visibilityChipColors[tone]}
        />
      }
    />
  );
}

VisibilityChip.displayName = "VisibilityChip";

const TONES = {
  PUBLIC: "public",
  FRIENDS: "friends",
  SECRET: "secret",
} as const satisfies Record<GiftCard["visibility"], VisibilityTone>;

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
