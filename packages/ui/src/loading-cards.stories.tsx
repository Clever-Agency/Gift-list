import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import { propDoc } from "../../../.storybook/argTypes";
import { LoadingCards } from "./loading-cards";

/**
 * `LoadingCards` is the one card-skeleton loading state of the app: a named busy
 * region (`role="status"`, `aria-busy`), not anonymous grey boxes. The sandbox
 * turns the name, the count and the card width.
 */
const meta = {
  title: "UI/LoadingCards",
  component: LoadingCards,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The one card-skeleton loading state of the app: a named busy region instead of anonymous grey boxes for assistive technology.

What is not a prop:

- The cards are \`UI/Skeleton\` blocks in the shape of \`WishCard\`; they never shimmer (\`DESIGN.md\` → Движение).
- The region is \`role="status"\` with \`aria-busy\` and the \`label\` as its accessible name, so a screen reader hears «Загружаем вишлист».
- The block is rendered inside the page's own \`PageScroll\` / \`PageContainer\`, so it never introduces another scroller. The page grid and the card width belong to the caller.
        `.trim(),
      },
    },
  },
  argTypes: {
    label: propDoc({
      description:
        "The live-region name, e.g. «Загружаем вишлист»: what assistive technology announces while the cards are loading.",
      type: "string",
      required: true,
      control: "text",
    }),
    testID: propDoc({
      description: "A stable handle for tests; reaches the web DOM as `data-testid`.",
      type: "string",
      control: "text",
    }),
    width: propDoc({
      description:
        "The width of each skeleton card: a number of px, or a string such as «100%» when the page grid sets it.",
      type: "number | string",
      control: "text",
    }),
    count: propDoc({
      description: "How many skeleton cards the loading state shows. Defaults to 3.",
      type: "number",
      control: "number",
      defaultValue: "3",
    }),
  },
  args: {
    label: "Загружаем вишлист",
    testID: "loading-cards",
    width: "100%",
    count: 3,
  },
} satisfies Meta<typeof LoadingCards>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The sandbox: turn the count and the card width — the row wraps as the page grid
 * would. The region stays named, so its `aria-label` is the only text it has.
 */
export const Playground: Story = {
  render: function PlaygroundStory(args) {
    return (
      <YStack width={360} maxWidth="100%">
        <LoadingCards {...args} />
      </YStack>
    );
  },
};

/** Six cards in the page grid at 360 px: the row wraps, nothing overflows. */
export const ManyNarrow: Story = {
  args: { count: 6, width: "100%" },
  render: function ManyNarrowStory(args) {
    return (
      <YStack width={360} maxWidth="100%">
        <LoadingCards {...args} />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** The default three cards. */
export const Three: Story = {
  tags: ["!dev"],
  args: { count: 3, width: "100%" },
  render: function ThreeStory(args) {
    return (
      <YStack width={360} maxWidth="100%">
        <LoadingCards {...args} />
      </YStack>
    );
  },
};

/** A single skeleton, e.g. a detail page that loads one wish. */
export const One: Story = {
  tags: ["!dev"],
  args: { count: 1, width: 200 },
  render: function OneStory(args) {
    return (
      <YStack width={320} maxWidth="100%">
        <LoadingCards {...args} />
      </YStack>
    );
  },
};
