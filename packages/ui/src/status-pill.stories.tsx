import type { Meta, StoryObj } from "@storybook/react";
import { XStack } from "@tamagui/stacks";
import { StatusPill } from "./status-pill";

/**
 * `StatusPill` is the status of a wish (AD-12), always spelled out: colour alone
 * never carries the meaning. It is not a control.
 */
const meta = {
  title: "UI/StatusPill",
  component: StatusPill,
  args: {
    status: "open",
    label: "Открыт",
  },
} satisfies Meta<typeof StatusPill>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Open: Story = {};

export const Reserved: Story = {
  args: { status: "reserved", label: "Забронирован" },
};

export const Closed: Story = {
  args: { status: "closed", label: "Получен" },
};

/** All three in a row, the way a list mixes them. */
export const AllStatuses: Story = {
  render: function AllStatusesStory() {
    return (
      <XStack gap="$2" flexWrap="wrap" width={360}>
        <StatusPill status="open" label="Открыт" />
        <StatusPill status="reserved" label="Забронирован" />
        <StatusPill status="closed" label="Получен" />
      </XStack>
    );
  },
};

/** A long status line at 360 px: the pill grows with its text and wraps. */
export const LongLabelNarrow: Story = {
  args: {
    status: "reserved",
    label: "Забронирован до 4 ноября, ждёт подтверждения владельца",
  },
  globals: { viewport: { value: "w360" } },
};
