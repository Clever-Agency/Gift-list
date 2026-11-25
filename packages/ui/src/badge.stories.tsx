import type { Meta, StoryObj } from "@storybook/react";
import { XStack, YStack } from "@tamagui/stacks";
import { propDoc } from "../../../.storybook/argTypes";
import { Badge } from "./badge";
import { Text } from "./text";

/**
 * `DESIGN.md` → Badge: the count pill of a tab, a sidebar item or the future
 * bell. The number is decorative for assistive technology — the item around it
 * says «Друзья, 2 запроса» — and a zero count draws nothing.
 *
 * The canvas is the sandbox: every public prop is a control (`argTypes`), and
 * the states below it are ready-made frames for the Docs page.
 */
const meta = {
  title: "UI/Badge",
  component: Badge,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The count pill of a tab, a sidebar item or the future bell. Up to two digits are shown, more becomes «99+», and a count of 0 (or less) draws nothing at all.

What is not a prop:

- The number is decorative: \`aria-hidden\` keeps it out of the tab order, and the item that owns it says the number in its own accessible name («Друзья, 2 запроса»).
- The look (\`$primary\` on \`$primary-foreground\`, \`rounded.sm\`, \`caption\` 600) comes from the theme; the catalog has no handle for colours.
- The pill sits on the edge of its item; that placement belongs to the tab or the sidebar row, not to this component.
        `.trim(),
      },
    },
  },
  argTypes: {
    count: propDoc({
      description:
        "How many items are waiting. 100 and more read «99+»; 0 and negative numbers draw nothing.",
      type: "number",
      required: true,
      control: "number",
    }),
    testID: propDoc({
      description: "A stable handle for tests; reaches the web DOM as `data-testid`.",
      type: "string",
      control: "text",
    }),
  },
  args: {
    count: 2,
    testID: "badge",
  },
} satisfies Meta<typeof Badge>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The sandbox of the docs page: turn `count` and `testID` in the panel. Set the
 * count to 0 to see that the pill leaves the tree completely.
 */
export const Playground: Story = {};

/** More than 99 is «99+», the widest shape of the pill. */
export const LargeCount: Story = {
  args: { count: 120 },
};

/** A few incoming requests: the number as it is. */
export const Normal: Story = {
  tags: ["!dev"],
  args: { count: 2 },
};

/** Zero means nothing waits: the badge is not in the tree at all. */
export const Zero: Story = {
  tags: ["!dev"],
  args: { count: 0 },
  render: function ZeroStory(args) {
    return (
      <YStack gap="$2" alignItems="center">
        <XStack padding="$3">
          <Badge {...args} />
        </XStack>
        <Text kind="caption" tone="muted">
          При нуле бейджа нет совсем
        </Text>
      </YStack>
    );
  },
};

/** The widest pill at 360 px: it still fits a tab caption and does not overflow. */
export const Narrow: Story = {
  tags: ["!dev"],
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
