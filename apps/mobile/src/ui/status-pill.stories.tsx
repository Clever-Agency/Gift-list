import type { Meta, StoryObj } from "@storybook/react";
import { XStack } from "@gift-list/ui";
import { StatusPill } from "./status-pill";

/**
 * The app's status pill: the wire status mapped onto the catalogue word
 * («Открыт» / «Забронирован» / «Получен», `DESIGN.md` → StatusPill). It is never a
 * button, so there is no pressed or hover state to show.
 */
const meta = {
  title: "App/StatusPill",
  component: StatusPill,
  args: { status: "OPEN" },
} satisfies Meta<typeof StatusPill>;

export default meta;

type Story = StoryObj<typeof meta>;

/** «Открыт»: the wish can be reserved. */
export const Open: Story = {};

/** «Забронирован»: someone is buying it. */
export const Reserved: Story = {
  args: { status: "RESERVED" },
};

/** «Получен»: the wish is closed and the card fades (see `App/WishCard`). */
export const Closed: Story = {
  args: { status: "CLOSED" },
};

/** All three side by side, as a list mixes them. */
export const AllStatuses: Story = {
  render: function AllStatusesStory() {
    return (
      <XStack gap="$2" flexWrap="wrap" width={320}>
        <StatusPill status="OPEN" />
        <StatusPill status="RESERVED" />
        <StatusPill status="CLOSED" />
      </XStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};
