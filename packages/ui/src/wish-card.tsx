import { View, styled } from "@tamagui/core";
import { YStack } from "@tamagui/stacks";
import type { ReactNode } from "react";
import { Pressable } from "./pressable";
import { Text } from "./text";

const Card = styled(View, {
  name: "GLWishCard",
  // The chip layer is positioned against the card (the web needs it spelled out).
  position: "relative",
  backgroundColor: "$surface",
  borderWidth: 1,
  borderColor: "$border",
  borderRadius: "$lg",
  variants: {
    // Only a card you can press lights up on hover.
    interactive: {
      true: { borderColor: "$border hover:$primary" },
    },
  } as const,
});

export type WishCardProps = {
  title: string;
  /** A closed wish reads as muted. */
  closed?: boolean;
  /** Formatted price, e.g. «12 000 ₽». */
  price?: string | null;
  /** The StatusPill. */
  status: ReactNode;
  /** The reservation line, «Подписи брони» in `EXPERIENCE.md`. */
  reservation?: string | null;
  /** The visibility chip; drawn over the reserved footer as a sibling of the main zone. */
  chip?: ReactNode;
  /** The chip is a button of its own: its layer takes presses, the rest goes to the card. */
  chipInteractive?: boolean;
  /** With `onPress` the whole card is a button; without it, plain list content. */
  onPress?: () => void;
  /** The accessible name of the card button, e.g. «Редактировать «{title}»». */
  pressLabel?: string;
  /** Card width in px, or a CSS size. Defaults to the full width of the parent. */
  width?: number | string;
  testID?: string;
};

/**
 * `DESIGN.md` → WishCard (AD-12). Presentational: the app builds the status pill,
 * the chip and the texts from its data. The card is a list item; the press zone of
 * an owner card is the whole card (body, the footer area reserved under it and the
 * padding), and the chip is a later sibling drawn over the reserved footer, never
 * inside the button: nothing is nested and Tab reaches the card first, the chip second.
 */
export function WishCard({
  title,
  closed,
  price,
  status,
  reservation,
  chip,
  chipInteractive,
  onPress,
  pressLabel,
  width,
  testID,
}: WishCardProps) {
  const content = (
    <>
      <YStack gap="$2">
        <Text kind="body-strong" tone={closed ? "muted" : "default"} numberOfLines={2}>
          {title}
        </Text>
        {price ? (
          <Text kind="label" tone="muted">
            {price}
          </Text>
        ) : null}
        {status}
        {reservation ? (
          <Text kind="label" tone="reserved">
            {reservation}
          </Text>
        ) : null}
      </YStack>
      {/* The footer area, reserved so the chip layer has room and the empty space
          next to the chip belongs to the card button. */}
      <View marginTop="$3" height="$chip-height" />
    </>
  );

  return (
    <Card role="listitem" width={width} testID={testID} interactive={Boolean(onPress)}>
      {onPress ? (
        <Pressable
          aria-label={pressLabel ?? title}
          onPress={onPress}
          padding="$card-padding"
          borderRadius="$lg"
        >
          {content}
        </Pressable>
      ) : (
        <View padding="$card-padding">{content}</View>
      )}
      {chip ? (
        <View
          position="absolute"
          left="$card-padding"
          bottom="$card-padding"
          zIndex="$base"
          // `box-none`: presses outside an interactive chip reach the card button
          // underneath; a chip without a button lets every press through.
          pointerEvents={chipInteractive ? "box-none" : "none"}
        >
          {chip}
        </View>
      ) : null}
    </Card>
  );
}

WishCard.displayName = "WishCard";
