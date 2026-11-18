import { View, styled } from "@tamagui/core";
import { YStack } from "@tamagui/stacks";
import { spacing, typography } from "./tokens";

/** A `muted` block (`DESIGN.md` → Мелкие элементы: skeleton), radius 8. */
export const Skeleton = styled(View, {
  name: "GLSkeleton",
  backgroundColor: "$muted",
  borderRadius: "$md",
});

export type WishCardSkeletonProps = {
  width?: number | string;
  testID?: string;
};

/**
 * The v8 card skeleton: the same shape as `WishCard` — a 4:5 photo plate with radius
 * 16, two text lines under it and the reserved chip footer. Static blocks, no
 * shimmer (`DESIGN.md` → Движение).
 */
export function WishCardSkeleton({ width, testID }: WishCardSkeletonProps) {
  return (
    <YStack testID={testID} width={width} gap="$1" alignItems="stretch">
      <Skeleton width="100%" aspectRatio={4 / 5} borderRadius="$lg" testID="wish-card-skeleton-photo" />
      <YStack paddingTop="$2" paddingHorizontal="$1" gap="$1">
        <Skeleton height={typography["body-strong"].lineHeight} width="85%" />
        <Skeleton height={typography.label.lineHeight} width="45%" />
        <Skeleton height={spacing["pill-height"]} width="65%" />
      </YStack>
      <View marginTop="$2" height="$chip-height" />
    </YStack>
  );
}

WishCardSkeleton.displayName = "WishCardSkeleton";
