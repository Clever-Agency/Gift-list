import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import { propDoc } from "../../../.storybook/argTypes";
import { Skeleton, WishCardSkeleton } from "./skeleton";

/**
 * Skeletons are static `muted` blocks shaped like the content they stand for;
 * they never shimmer (`DESIGN.md` → Мелкие элементы, Движение). The sandbox turns
 * the size of one block; the card-shaped frames below show the whole set.
 */
const meta = {
  title: "UI/Skeleton",
  component: Skeleton,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
A static \`muted\` block with the control radius (8), shaped like the content it stands for. Skeletons never shimmer: there is no animation in the loading state (\`DESIGN.md\` → Мелкие элементы, Движение).

What is not a prop:

- The colour and the radius come from the theme; the block takes only the size the content will need.
- \`WishCardSkeleton\` is a ready-made card shape built from these blocks — a 4:5 photo plate and the two text lines under it. It is not a second component of its own.
- The loading state itself is \`UI/LoadingCards\`: a named busy region (\`role="status"\`, \`aria-busy\`) around the cards, so assistive technology hears «Загружаем вишлист» instead of anonymous boxes.
        `.trim(),
      },
    },
  },
  argTypes: {
    width: propDoc({
      description:
        "The width of the block: a number of px, or a string such as «100%» or «85%» when the block follows its parent.",
      type: "number | string",
      control: "number",
      defaultValue: "240",
    }),
    height: propDoc({
      description: "The height of the block in px. Text lines use the line height of the role they stand for.",
      type: "number | string",
      control: "number",
      defaultValue: "16",
    }),
    testID: propDoc({
      description: "A stable handle for tests; reaches the web DOM as `data-testid`.",
      type: "string",
      control: "text",
    }),
  },
  args: {
    width: 240,
    height: 16,
    testID: "skeleton",
  },
} satisfies Meta<typeof Skeleton>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The sandbox: turn `width` and `height` in the panel — the block is exactly the
 * size the content will take. It stays static: there is nothing to animate.
 */
export const Playground: Story = {
  render: function PlaygroundStory(args) {
    return (
      <YStack width={360} maxWidth="100%" alignItems="flex-start">
        <Skeleton {...args} />
      </YStack>
    );
  },
};

/** A block is any size the content needs; the radius is the control one (8). */
export const Block: Story = {
  args: { width: 240, height: 16 },
  render: function BlockStory(args) {
    return (
      <YStack width={360} maxWidth="100%" alignItems="flex-start">
        <Skeleton {...args} />
      </YStack>
    );
  },
};

/** A card-shaped skeleton: title, price and pill lines, the size a card will take. */
export const Card: Story = {
  tags: ["!dev"],
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
  tags: ["!dev"],
  render: function CardSkeletonNarrowStory() {
    return (
      <YStack width={328}>
        <WishCardSkeleton width="100%" />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};
