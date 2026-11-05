import { View, styled } from "@tamagui/core";
import { YStack } from "@tamagui/stacks";
import { spacing, typography } from "./tokens";

/** A `muted` block (`DESIGN.md` → Мелкие элементы: skeleton). */
export const Skeleton = styled(View, {
  name: "GLSkeleton",
  backgroundColor: "$muted",
  borderRadius: "$sm",
});

export type WishCardSkeletonProps = {
  width?: number | string;
  testID?: string;
};

/** A skeleton shaped like a wish card: title, price and pill lines. */
export function WishCardSkeleton({ width, testID }: WishCardSkeletonProps) {
  return (
    <YStack
      testID={testID}
      width={width}
      backgroundColor="$surface"
      borderWidth={1}
      borderColor="$border"
      borderRadius="$lg"
      padding="$card-padding"
      gap="$2"
    >
      <Skeleton height={typography["body-strong"].lineHeight} width="80%" />
      <Skeleton height={spacing["icon-small"]} width="40%" />
      <Skeleton height="$pill-height" width="64%" />
    </YStack>
  );
}

WishCardSkeleton.displayName = "WishCardSkeleton";
