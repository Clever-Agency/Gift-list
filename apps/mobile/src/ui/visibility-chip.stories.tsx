import type { Meta, StoryObj } from "@storybook/react";
import { XStack, YStack } from "@gift-list/ui";
import { VisibilityChip } from "./visibility-chip";

/**
 * The app's visibility chip: the catalogue word (`app.gift.visibility`) plus the
 * decorative icon, drawn by `expo-symbols` — the catalog mocks that module and
 * shows a neutral outlined square in the tone colour (the word carries the meaning,
 * `DESIGN.md` → VisibilityChip).
 *
 * On an `OPEN` wish the chip is a button with `aria-haspopup="dialog"`; on
 * `RESERVED` / `CLOSED` it only shows the value, so it has no `onPress`.
 */
const meta = {
  title: "App/VisibilityChip",
  component: VisibilityChip,
  args: { visibility: "PUBLIC", onPress: noop },
} satisfies Meta<typeof VisibilityChip>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

/** «Всем» on an open wish: the chip opens the picker. */
export const PublicPressable: Story = {};

/** «Друзьям» on an open wish. */
export const FriendsPressable: Story = {
  args: { visibility: "FRIENDS" },
};

/** «Секрет» on an open wish. */
export const SecretPressable: Story = {
  args: { visibility: "SECRET" },
};

/** A wish that is no longer open: the value only, no press, no `aria-haspopup`. */
export const StaticReserved: Story = {
  args: { visibility: "FRIENDS", onPress: undefined },
};

/** All three tones in a row, as the picker lists them. */
export const AllTones: Story = {
  render: function AllTonesStory() {
    return (
      <XStack gap="$3" flexWrap="wrap" width={328}>
        <VisibilityChip visibility="PUBLIC" onPress={noop} />
        <VisibilityChip visibility="FRIENDS" onPress={noop} />
        <VisibilityChip visibility="SECRET" onPress={noop} />
      </XStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** Inside the card footer: the chip sits next to the reservation line. */
export const InCardFooter: Story = {
  render: function InCardFooterStory() {
    return (
      <YStack width={328} gap="$2" padding="$3" backgroundColor="$surface" borderRadius="$md">
        <VisibilityChip visibility="SECRET" onPress={noop} />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};
