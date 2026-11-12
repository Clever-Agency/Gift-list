import { View, styled } from "@tamagui/core";
import { YStack } from "@tamagui/stacks";
import { Pressable } from "./pressable";
import { Skeleton } from "./skeleton";
import { Text } from "./text";
import { typography } from "./tokens";

/**
 * The card around a person: `DESIGN.md` → PersonRow, reduced to the two fields
 * the search answer carries. The row is a link to the profile; a search result
 * never includes wishes, email, id or the hidden flag (NFR-3, AD-13).
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

const PlainRow = styled(View, {
  name: "GLPersonRow",
  ...cardSkin,
});

export type PersonRowProps = {
  displayName: string;
  nick: string;
  /**
   * The accessible name of the profile link, e.g. «Открыть профиль @nick».
   * The visible text is the name and `@ник` only.
   */
  pressLabel?: string;
  /** Without it the row is plain list content, not a link. */
  onPress?: () => void;
  testID?: string;
};

export function PersonRow({ displayName, nick, pressLabel, onPress, testID }: PersonRowProps) {
  const content = (
    <YStack gap="$1">
      <Text kind="body-strong" numberOfLines={1}>
        {displayName}
      </Text>
      <Text kind="caption" tone="muted" numberOfLines={1}>
        @{nick}
      </Text>
    </YStack>
  );

  if (onPress === undefined) {
    return (
      <PlainRow testID={testID} width="100%">
        {content}
      </PlainRow>
    );
  }

  return (
    <Pressable
      role="link"
      aria-label={pressLabel}
      onPress={onPress}
      testID={testID}
      width="100%"
      {...cardSkin}
    >
      {content}
    </Pressable>
  );
}

PersonRow.displayName = "PersonRow";

export type PersonRowSkeletonProps = {
  testID?: string;
};

/** A skeleton shaped like a `PersonRow`: the name and the `@ник` lines. */
export function PersonRowSkeleton({ testID }: PersonRowSkeletonProps) {
  return (
    <PlainRow testID={testID} width="100%" gap="$2">
      <Skeleton height={typography["body-strong"].lineHeight} width="60%" />
      <Skeleton height={typography.caption.lineHeight} width="30%" />
    </PlainRow>
  );
}

PersonRowSkeleton.displayName = "PersonRowSkeleton";
