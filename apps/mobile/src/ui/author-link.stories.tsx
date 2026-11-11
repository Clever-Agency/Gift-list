import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@gift-list/ui";
import { AuthorLink } from "./author-link";

/**
 * «Написать автору» of the app footer. The address is the public `AUTHOR_MAILTO`
 * constant from `packages/contracts` (AD-24, D-35), so the link is always active:
 * there is no configured-empty state to show. A missing mail client only rejects
 * `openURL`, which the component swallows.
 */
const meta = {
  title: "App/AuthorLink",
  component: AuthorLink,
} satisfies Meta<typeof AuthorLink>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The pressable link in the footer row. */
export const Default: Story = {
  render: function DefaultStory() {
    return (
      <YStack width={328} alignItems="center">
        <AuthorLink />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** The ring and hover come from the real control: hover it or press Tab. */
export const InFooterRow: Story = {
  render: function InFooterRowStory() {
    return (
      <YStack width={328} gap="$2" alignItems="center">
        <AuthorLink />
      </YStack>
    );
  },
};
