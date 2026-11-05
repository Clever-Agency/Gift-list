import { View, styled } from "@tamagui/core";
import { forwardRef, type ComponentRef, type ReactNode } from "react";
import { Pressable } from "./pressable";
import { Text } from "./text";
import { colors, spacing } from "./tokens";

const Chip = styled(View, {
  name: "GLVisibilityChip",
  alignSelf: "flex-start",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: "$1",
  minHeight: "$chip-height",
  borderWidth: 1,
  borderColor: "$border-strong",
  borderRadius: "$sm",
  paddingHorizontal: "$2",
  variants: {
    tone: {
      public: { backgroundColor: "$surface", borderStyle: "solid" },
      friends: { backgroundColor: "$muted", borderStyle: "solid" },
      secret: { backgroundColor: "transparent", borderStyle: "dashed" },
    },
  } as const,
});

export type VisibilityTone = "public" | "friends" | "secret";

/** The text/icon colour of each tone (`DESIGN.md` → components `visibility-chip-*`). */
export const visibilityChipColors = {
  public: colors.primary,
  friends: colors.foreground,
  secret: colors["muted-foreground"],
} as const satisfies Record<VisibilityTone, string>;

const TEXT_TONES = {
  public: "primary",
  friends: "default",
  secret: "muted",
} as const;

export type VisibilityChipProps = {
  tone: VisibilityTone;
  /** «Всем» / «Друзьям» / «Секрет»: the word carries the meaning. */
  label: string;
  /**
   * The icon (globe / users / lock), drawn by the app with its icon set. It is
   * decorative: the label is the accessible name. Colour it with `visibilityChipColors`.
   */
  icon?: ReactNode;
  /** With `onPress` the chip is a button that opens the visibility layer. */
  onPress?: () => void;
  /** The name of the button, e.g. «Видимость: всем. Изменить». Used with `onPress`. */
  accessibilityLabel?: string;
};

/**
 * `DESIGN.md` → VisibilityChip. Without `onPress` it only shows the value (a
 * reserved or closed wish) and lets a press through to the card underneath. With
 * it, it is a button of its own (`aria-haspopup="dialog"`): the visual stays 28 px
 * tall, the touch zone grows to 44 px with a transparent wrapper.
 */
export const VisibilityChip = forwardRef<ComponentRef<typeof Pressable>, VisibilityChipProps>(
  function VisibilityChip({ tone, label, icon, onPress, accessibilityLabel }, ref) {
    const content = (
      <Chip tone={tone}>
        {icon ? (
          <View aria-hidden importantForAccessibility="no-hide-descendants">
            {icon}
          </View>
        ) : null}
        <Text kind="caption" tone={TEXT_TONES[tone]}>
          {label}
        </Text>
      </Chip>
    );

    if (!onPress) {
      return content;
    }

    return (
      <Pressable
        ref={ref}
        aria-label={accessibilityLabel ?? label}
        aria-haspopup="dialog"
        onPress={onPress}
        alignSelf="flex-start"
        justifyContent="center"
        minHeight="$touch-target"
        minWidth="$touch-target"
        // The visual is 28 tall; the 44 touch zone is built from this wrapper and
        // the negative margin keeps the layout at 28.
        marginVertical={-(spacing["touch-target"] - spacing["chip-height"]) / 2}
      >
        {content}
      </Pressable>
    );
  },
);

VisibilityChip.displayName = "VisibilityChip";
