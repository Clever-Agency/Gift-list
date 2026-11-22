import type { Meta, StoryObj } from "@storybook/react";
import { XStack } from "@tamagui/stacks";
import { Badge } from "./badge";

/**
 * `DESIGN.md` → Badge: the count pill of a tab, a sidebar item or the future
 * bell. The number is decorative for assistive technology — the item around it
 * says «Друзья, 2 запроса» — and a zero count draws nothing.
 */
const meta = {
  title: "UI/Badge",
  component: Badge,
  args: { count: 2 },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A few incoming requests: the number as it is. */
export const Normal: Story = {
  render: function NormalStory(args) {
    return (
      <XStack padding="$3">
        <Badge count={args.count} testID="badge" />
      </XStack>
    );
  },
};

/** More than 99 is «99+», the widest shape of the pill. */
export const LargeCount: Story = {
  args: { count: 120 },
  render: function LargeCountStory(args) {
    return (
      <XStack padding="$3">
        <Badge count={args.count} testID="badge" />
      </XStack>
    );
  },
};

/** Zero means nothing waits: the badge is not in the tree at all. */
export const Zero: Story = {
  args: { count: 0 },
  render: function ZeroStory(args) {
    return (
      <XStack padding="$3">
        <Badge count={args.count} testID="badge" />
      </XStack>
    );
  },
};

/** The widest pill at 360 px: it still fits a tab caption and does not overflow. */
export const Narrow: Story = {
  args: { count: 120 },
  render: function NarrowStory(args) {
    return (
      <XStack width={360} padding="$3" gap="$2">
        <Badge count={1} testID="badge-one" />
        <Badge count={12} testID="badge-twelve" />
        <Badge count={args.count} testID="badge-large" />
      </XStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};
