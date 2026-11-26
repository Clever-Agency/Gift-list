import { View, styled } from "@tamagui/core";
import { XStack, YStack } from "@tamagui/stacks";
import { forwardRef, type ComponentRef, type ReactNode } from "react";
import { Avatar } from "./avatar";
import { focusRing } from "./focus-ring";
import { useHoverTransition } from "./hover";
import { Skeleton } from "./skeleton";
import { Text } from "./text";
import { typography } from "./tokens";

/**
 * The card around a person: `DESIGN.md` → PersonRow, reduced to the fields a
 * person list carries. The row is a link to the profile; the lists never carry
 * wishes, email, id or the hidden flag (NFR-3, AD-13).
 */
const cardSkin = {
  backgroundColor: "$surface",
  borderWidth: 1,
  borderColor: "$border",
  borderRadius: "$lg",
  padding: "$card-padding",
  minHeight: "$row-height",
  justifyContent: "center",
} as const;

/**
 * v8 mobile list variant: the cheers of a card give way to a plain row that the list
 * separates with a divider — no surface, no frame, 56 px tall around the 40 px avatar.
 */
const rowSkin = {
  backgroundColor: "transparent",
  borderWidth: 0,
  borderRadius: 0,
  paddingVertical: "$2",
  paddingHorizontal: "$1",
  minHeight: "$row-height",
  justifyContent: "center",
} as const;

const variants = {
  variant: {
    card: cardSkin,
    row: rowSkin,
  },
} as const;

const defaultVariants = { variant: "card" } as const;

/** Plain list content: the row without any link behaviour. */
const PlainRow = styled(View, {
  name: "GLPersonRow",
  ...cardSkin,
  variants,
  defaultVariants,
});

/**
 * The row that is also a real link. `render="a"` makes the web root an
 * `<a href>` — the browser then handles «открыть в новой вкладке», the middle
 * click and the context menu itself, without the router. The anchor resets the
 * browser underline (text decoration is inherited by the text descendants) and
 * keeps the pointer, the press feedback and the focus ring of the other
 * interactive surfaces (`DESIGN.md` → App). On hover the card fills `$muted`
 * (CLE-129); a row on the page background takes the same fill.
 */
const LinkRow = styled(View, {
  name: "GLPersonRowLink",
  ...cardSkin,
  display: "flex",
  textDecorationLine: "none",
  cursor: "pointer",
  opacity: "press:0.9",
  ...focusRing,
  variants: {
    variant: {
      card: { backgroundColor: "$surface hover:$muted" },
      row: { backgroundColor: "transparent hover:$muted" },
    },
  },
  defaultVariants,
});

export type PersonRowVariant = "card" | "row";

export type PersonRowProps = {
  displayName: string;
  nick: string;
  /**
   * The person's photo; without it the avatar shows the initials of the name. The
   * avatar is decorative — the name is written next to it.
   */
  photoUrl?: string | null;
  /**
   * `card` (default) is the surface card of the older lists; `row` is the v8 mobile
   * list variant — a plain row the list divides with a hairline.
   */
  variant?: PersonRowVariant;
  /**
   * The relation or subscription chip on the right of the row (`RelationshipChip`
   * in the app). It is part of the row's accessible name, which the caller builds.
   */
  chip?: ReactNode;
  /**
   * The row's own controls, e.g. the ⋮ menu. They are siblings of the profile
   * link, never its children, so a press on a control cannot open the profile.
   */
  actions?: ReactNode;
  /**
   * The accessible name of the profile link, e.g. «Открыть профиль @nick».
   * The visible text is the name and `@ник` only.
   */
  pressLabel?: string;
  /**
   * The profile address. With it the row is a link and the web draws an
   * `<a href>`; without it the row is plain list content.
   */
  href?: string;
  /**
   * The router's press, handed over by the router's `Link asChild`; a phone
   * needs it because it has no anchor of its own.
   */
  onPress?: (event?: unknown) => void;
  testID?: string;
};

/**
 * `forwardRef` is part of the link contract: `Link asChild` puts `href`,
 * `onPress` and the `ref` onto the row's root. Nothing else is taken from that
 * element, so the router's extra web `onClick` cannot run the navigation twice.
 */
export const PersonRow = forwardRef<ComponentRef<typeof LinkRow>, PersonRowProps>(
  function PersonRow(
    { displayName, nick, photoUrl, variant = "card", chip, actions, pressLabel, href, onPress, testID },
    ref,
  ) {
    const transition = useHoverTransition();
    const content = (
      <XStack alignItems="center" gap="$2" flex={1}>
        <Avatar name={displayName} photoUrl={photoUrl} size="md" decorative testID={testID ? `${testID}-avatar` : undefined} />
        <YStack gap="$1" flex={1} minWidth={0}>
          <Text kind="body-strong" numberOfLines={1}>
            {displayName}
          </Text>
          <Text kind="body-sm" tone="muted" numberOfLines={1}>
            @{nick}
          </Text>
        </YStack>
        {chip ? <View flexShrink={0}>{chip}</View> : null}
      </XStack>
    );

    function renderCard() {
      if (href === undefined) {
        return (
          <PlainRow
            ref={ref}
            testID={testID}
            variant={variant}
            flex={actions ? 1 : undefined}
            width={actions ? undefined : "100%"}
          >
            {content}
          </PlainRow>
        );
      }

      // Tamagui's `View` props type has no `href`; the anchor attribute is spread
      // past it, and `render="a"` turns the root into the element that takes it.
      const anchor = { href };

      return (
        <LinkRow
          ref={ref}
          render="a"
          {...anchor}
          role="link"
          aria-label={pressLabel}
          onPress={onPress}
          transition={transition}
          testID={testID}
          variant={variant}
          flex={actions ? 1 : undefined}
          width={actions ? undefined : "100%"}
        >
          {content}
        </LinkRow>
      );
    }

    if (actions === undefined) return renderCard();

    return (
      <XStack width="100%" alignItems="center" flexWrap="wrap" gap="$2">
        {renderCard()}
        {actions}
      </XStack>
    );
  },
);

PersonRow.displayName = "PersonRow";

export type PersonRowSkeletonProps = {
  testID?: string;
};

/** A skeleton shaped like a `PersonRow`: the avatar circle, the name and the `@ник`. */
export function PersonRowSkeleton({ testID }: PersonRowSkeletonProps) {
  return (
    <XStack testID={testID} width="100%" alignItems="center" gap="$2" paddingVertical="$2" minHeight="$row-height">
      <Skeleton width={40} height={40} borderRadius="$full" />
      <YStack flex={1} gap="$1">
        <Skeleton height={typography["body-strong"].lineHeight} width="60%" />
        <Skeleton height={typography["body-sm"].lineHeight} width="30%" />
      </YStack>
    </XStack>
  );
}

PersonRowSkeleton.displayName = "PersonRowSkeleton";
