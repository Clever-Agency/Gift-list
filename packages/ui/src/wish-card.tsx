import { View, styled } from "@tamagui/core";
import { YStack } from "@tamagui/stacks";
import type { ComponentRef, ReactNode, Ref } from "react";
import { useHoverTransition } from "./hover";
import { PhotoPlaceholder } from "./photo-placeholder";
import { Pressable } from "./pressable";
import { Text } from "./text";

/**
 * `DESIGN.md` → WishCard: the v8 vertical Pinterest card. There is no frame around
 * the whole cell — the photo plate carries radius 16 and the elevation, and the text
 * stands on the page background under it. The card is the `listitem`; the whole cell
 * is the press zone when the caller passes `onPress`.
 */
const Card = styled(View, {
  name: "GLWishCard",
  // The chip layer is positioned against the card (the web needs it spelled out).
  position: "relative",
});

/**
 * The 4:5 photo plate: radius 16, the v8 card elevation from the theme
 * (`$shadow-card`: two soft layers in the light theme, tone plus top-edge highlight
 * in the dark one). A pressable card lifts the plate's shadow when the pointer is
 * anywhere over the card, not only over the plate: the button is the Tamagui group
 * and the plate listens to `group-hover` (CLE-129, T2.2).
 */
const Photo = styled(YStack, {
  name: "GLWishCardPhoto",
  width: "100%",
  aspectRatio: 4 / 5,
  overflow: "hidden",
  borderRadius: "$lg",
  backgroundColor: "$muted",
  alignItems: "center",
  justifyContent: "center",
  boxShadow: "$shadow-card",
  variants: {
    interactive: {
      true: { boxShadow: "$shadow-card group-hover:$shadow-card-hover" },
    },
  } as const,
});

/**
 * No photo yet: the v8 placeholder (`blocks/14-photo-placeholders.png`) — a calm
 * themed panel with a soft light spot and the moon of the product, no text and no
 * image. Its tint is derived from the title, so the same wish always looks the same
 * and a grid of placeholders never flashes one colour.
 */
export type WishCardProps = {
  title: string;
  /** A closed wish reads as muted. */
  closed?: boolean;
  /** Formatted price, e.g. «12 000 ₽»: the v8 card shows the price without a store. */
  price?: string | null;
  /** The StatusPill. */
  status: ReactNode;
  /** The tag row, e.g. the app's `TagChipList` (`DESIGN.md` → WishCard). */
  tags?: ReactNode;
  /** The reservation line, «Подписи брони» in `EXPERIENCE.md`. */
  reservation?: string | null;
  /** The visibility chip; drawn over the reserved footer as a sibling of the main zone. */
  chip?: ReactNode;
  /** The chip is a button of its own: its layer takes presses, the rest goes to the card. */
  chipInteractive?: boolean;
  /** With `onPress` the whole card is a button; without it, plain list content. */
  onPress?: () => void;
  /**
   * The accessible name of the card button: the full content phrase from
   * `DESIGN.md` → Доступность, e.g. «Плед, 2 500 ₽, Открыт, мечта, видимость всем».
   * With `onPress` the app supplies it; without it the content text is the name.
   */
  pressLabel?: string;
  /** The card button, so a closing detail dialog can return focus to it. */
  pressRef?: Ref<ComponentRef<typeof Pressable>>;
  /** Card width in px, or a CSS size. Defaults to the full width of the parent. */
  width?: number | string;
  /** Owner menu, a sibling of the card button (Story 2.6 archive). */
  menu?: ReactNode;
  /**
   * Whether the card itself is the `listitem` of the surrounding `role="list"`.
   * Story 5.6 passes `false` when an owner strip stands next to the card: then the
   * wrapper of the cell carries the role, so the strip buttons stay inside the one
   * list item. Defaults to `true`.
   */
  listItem?: boolean;
  testID?: string;
};

/**
 * `DESIGN.md` → WishCard (AD-12). Presentational: the app builds the status pill,
 * the chip and the texts from its data. The card is a list item; the press zone of
 * an owner card is the whole card (photo, body, the footer area reserved under it
 * and the gaps), and the chip is a later sibling drawn over the reserved footer,
 * never inside the button: nothing is nested and Tab reaches the card first, the
 * chip second.
 *
 * v8 layout: the 4:5 photo plate on top (placeholder until a wish has a photo),
 * then the title (two lines, ellipsis), the price, the status pill, the tags and the
 * reservation line — all below the photo on the page background, never as text on
 * the photo. There is no heart and no gifted-progress bar.
 */
export function WishCard({
  title,
  closed,
  price,
  status,
  tags,
  reservation,
  chip,
  chipInteractive,
  onPress,
  pressLabel,
  pressRef,
  width,
  menu,
  listItem = true,
  testID,
}: WishCardProps) {
  // The whole press zone is the Tamagui group of the card: the plate's shadow and
  // the underlined title react to hovering any part of the button, not just the
  // photo (CLE-129, T2.2). The shadow glides with the shared `quick` preset.
  const transition = useHoverTransition();
  const content = (
    <>
      <Photo
        interactive={Boolean(onPress)}
        transition={onPress ? transition : null}
        testID={testID ? `${testID}-photo` : undefined}
      >
        <PhotoPlaceholder seed={title} />
      </Photo>
      <YStack
        gap="$1"
        paddingTop="$2"
        paddingHorizontal="$1"
        paddingRight={menu ? "$touch-target" : "$1"}
      >
        <Text
          kind="body-strong"
          tone={closed ? "muted" : "default"}
          numberOfLines={2}
          textDecorationLine={onPress ? "group-hover:underline" : undefined}
          testID={testID ? `${testID}-title` : undefined}
        >
          {title}
        </Text>
        {price ? (
          <Text kind="label" fontWeight="600" tone={closed ? "muted" : "default"}>
            {price}
          </Text>
        ) : null}
        {status}
        {tags ? <View>{tags}</View> : null}
        {reservation ? (
          <Text kind="label" tone="reserved">
            {reservation}
          </Text>
        ) : null}
      </YStack>
      {/* The footer area, reserved so the chip layer has room and the empty space
          next to the chip belongs to the card button. */}
      <View marginTop="$2" height="$chip-height" />
    </>
  );

  return (
    <Card role={listItem ? "listitem" : undefined} width={width} testID={testID}>
      {onPress ? (
        <Pressable
          ref={pressRef}
          aria-label={pressLabel}
          onPress={onPress}
          borderRadius="$lg"
          // The card paints its hover itself — the lifted plate and the underlined
          // title — so the general `$muted` fill of `Pressable` would double it
          // (CLE-129, T2.2 decision).
          hoverFill={false}
          group
        >
          {content}
        </Pressable>
      ) : (
        <View>{content}</View>
      )}
      {menu ? (
        // The owner menu sits next to the title, under the photo (product decision
        // t477u). It stays a sibling of the card button, never nested in it: an
        // invisible 4:5 spacer of the photo's size pushes it below the plate, and
        // `box-none` lets presses outside the menu reach the card underneath.
        <View
          position="absolute"
          top={0}
          left={0}
          right={0}
          zIndex="$base"
          pointerEvents="box-none"
        >
          <View width="100%" aspectRatio={4 / 5} pointerEvents="none" />
          <View
            flexDirection="row"
            justifyContent="flex-end"
            paddingTop="$2"
            pointerEvents="box-none"
          >
            {menu}
          </View>
        </View>
      ) : null}
      {chip ? (
        <View
          position="absolute"
          left={0}
          bottom={0}
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
