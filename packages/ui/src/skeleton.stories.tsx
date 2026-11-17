import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import { Skeleton, WishCardSkeleton } from "./skeleton";

/**
 * Skeletons are static `muted` blocks shaped like the content they stand for;
 * they never shimmer (`DESIGN.md` → Мелкие элементы, Движение).
 */
const meta = {
  title: "UI/Skeleton",
  component: Skeleton,
  args: { width: 240, height: 16 },
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A block is any size the content needs; the radius is the small one. */
export const Block: Story = {};

/** A card-shaped skeleton: title, price and pill lines, the size a card will take. */
export const Card: Story = {
  render: function CardSkeletonStory() {
    return (
      <YStack gap="$3" width={320}>
        <WishCardSkeleton width="100%" />
        <WishCardSkeleton width="100%" />
      </YStack>
    );
  },
};

/** At 360 px the skeleton is still a full-width card. */
export const CardNarrow: Story = {
  render: function CardSkeletonNarrowStory() {
    return (
      <YStack width={328}>
        <WishCardSkeleton width="100%" />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};
