import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@gift-list/ui";
import { AuthorLink } from "./author-link";

/**
 * «Написать автору» of the app footer. The address is configuration
 * (`EXPO_PUBLIC_AUTHOR_URL`, AD-24); the catalog swaps that module for a mock and
 * always shows the pressable link. The configured-empty fallback — the same words
 * as plain text, no press — is covered by the unit tests of `AuthorLink`, because
 * a story cannot vary one module per story.
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
