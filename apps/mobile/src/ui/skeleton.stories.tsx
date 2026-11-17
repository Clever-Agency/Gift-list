import type { Meta, StoryObj } from "@storybook/react";
import { XStack } from "@gift-list/ui";
import { WishCardSkeleton } from "./skeleton";

/**
 * The card-shaped placeholder the wishlist shows while the list loads
 * (`DESIGN.md` → Мелкие элементы). The width comes from the screen's grid, so the
 * skeleton always sits exactly where the card will appear.
 */
const meta = {
  title: "App/WishCardSkeleton",
  component: WishCardSkeleton,
  args: { width: 320 },
} satisfies Meta<typeof WishCardSkeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

/** One card on a 360 px phone: the width the grid computes for a single column. */
export const OneCard: Story = {
  globals: { viewport: { value: "w360" } },
};

/** Two columns from `medium` (768 px), as `cardGrid` lays them out. */
export const TwoColumns: Story = {
  render: function TwoColumnsStory() {
    return (
      <XStack gap="$3" flexWrap="wrap">
        <WishCardSkeleton width={320} />
        <WishCardSkeleton width={320} />
      </XStack>
    );
  },
};
