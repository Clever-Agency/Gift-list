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
 * 16 and two text lines under it. Static blocks, no shimmer (`DESIGN.md` → Движение).
 * The card carries no chip row since D-54 (CLE-129, T4.1), so the skeleton ends with
 * the text lines: an empty `$chip-height` spacer would make it taller than the card
 * (T4.4).
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
    </YStack>
  );
}

WishCardSkeleton.displayName = "WishCardSkeleton";
