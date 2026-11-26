import { View, styled } from "@tamagui/core";
import { YStack } from "@tamagui/stacks";
import { forwardRef, type ComponentRef, type ReactNode, type Ref } from "react";
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
  // The menu layer is positioned against the card (the web needs it spelled out).
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
  /**
   * The reservation line, «Подписи брони» in `EXPERIENCE.md`. A string is drawn
   * as the plain label; a node lets the caller put the holder's name there as a
   * link (CLE-129, T4.2). The line is a sibling of the card button, so a link can
   * never end up nested in the button.
   */
  reservation?: ReactNode;
  /** With `onPress` the whole card is a button; without it, plain list content. */
  onPress?: () => void;
  /**
   * The accessible name of the card button: the full content phrase from
   * `DESIGN.md` → Доступность, e.g. «Плед, 2 500 ₽, Открыт, мечта, видимость всем».
   * With `onPress` the app supplies it; without it the content text is the name.
   */
  pressLabel?: string;
  /**
   * The card is a real link to the wish page (`EXPERIENCE.md` → вишлист гостя:
   * основная зона — ссылка на `/gifts/{id}`). On the web the press zone becomes
   * an `<a href>`, so the card opens in a new tab like any link; the router's
   * own `onPress` stays for the phone (CLE-129, T4.4).
   */
  href?: string;
  /** The card button, so a closing detail dialog can return focus to it. */
  pressRef?: Ref<ComponentRef<typeof Pressable>>;
  /** Card width in px, or a CSS size. Defaults to the full width of the parent. */
  width?: number | string;
  /** Owner menu, a sibling of the card button (Story 2.6 archive). */
  menu?: ReactNode;
  /**
   * The footer under the card body, a sibling of the card button: the actions of
   * a reservation card (`DESIGN.md` → ReservationCard: «Купил», «Подарил»,
   * «Продлить до…», the visibility switch). Interactive content stays out of the
   * card button, so nothing is nested and Tab reaches the card first, the footer
   * next.
   */
  footer?: ReactNode;
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
 * the tags and the texts from its data. The card is a list item; the press zone of
 * an owner card is the whole card (photo, body and the gaps), and the ⋯ menu is a
 * later sibling, never inside the button: nothing is nested and Tab reaches the
 * card first. With `href` the press zone is a real `<a>` to the wish page
 * (CLE-129, T4.4), so the web opens it in a new tab like any link.
 *
 * v8 layout: the 4:5 photo plate on top (placeholder until a wish has a photo),
 * then the title (two lines, ellipsis), the price, the status pill, the tags and the
 * reservation line — all below the photo on the page background, never as text on
 * the photo. There is no heart and no gifted-progress bar. D-54: there is no
 * visibility chip either — visibility changes only in the wish form. A `footer`
 * makes an action block of the caller (`ReservationCard`).
 */
export const WishCard = forwardRef<ComponentRef<typeof Pressable>, WishCardProps>(
  function WishCard(
    {
      title,
      closed,
      price,
      status,
      tags,
      reservation,
      onPress,
      pressLabel,
      href,
      pressRef,
      width,
      menu,
      footer,
      listItem = true,
      testID,
    },
    ref,
  ) {
    // The whole press zone is the Tamagui group of the card: the plate's shadow and
    // the underlined title react to hovering any part of the button, not just the
    // photo (CLE-129, T2.2). The shadow glides with the shared `quick` preset.
    const transition = useHoverTransition();
    // A card with a target is interactive even without `onPress`: the web anchor
    // navigates by itself, and the router adds its own press on the phone.
    const interactive = onPress !== undefined || href !== undefined;
    // Tamagui's `View` props type has no `href`; the attribute is spread past it and
    // `render="a"` turns the root into the element that takes it (as `PersonRow`).
    const anchor = href === undefined ? {} : { href };
    const content = (
      <>
        <Photo
          interactive={interactive}
          transition={interactive ? transition : null}
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
            textDecorationLine={interactive ? "group-hover:underline" : undefined}
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
        </YStack>
      </>
    );

    return (
      <Card role={listItem ? "listitem" : undefined} width={width} testID={testID}>
        {interactive ? (
          <Pressable
            // The router's `Link` gives its own ref: the card is the anchor it
            // hands `href` and `onPress` to (CLE-129, T4.4).
            ref={ref ?? pressRef}
            {...anchor}
            render={href === undefined ? undefined : "a"}
            role={href === undefined ? undefined : "link"}
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
        {reservation ? (
          // The reservation line is a sibling of the card button, not its content:
          // the holder's name may be a link to the profile, and a link inside a
          // button would be invalid and unreachable by Tab (CLE-129, T4.2).
          <YStack
            paddingTop="$1"
            paddingHorizontal="$1"
            paddingRight={menu ? "$touch-target" : "$1"}
            testID={testID ? `${testID}-reservation` : undefined}
          >
            {typeof reservation === "string" ? (
              <Text kind="label" tone="reserved">
                {reservation}
              </Text>
            ) : (
              reservation
            )}
          </YStack>
        ) : null}
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
        {footer ? (
          // The actions of the card, never inside the card button: Tab goes card,
          // then the fields and buttons of the footer.
          <View marginTop="$2" testID={testID ? `${testID}-footer` : undefined}>
            {footer}
          </View>
        ) : null}
      </Card>
    );
  },
);

WishCard.displayName = "WishCard";
