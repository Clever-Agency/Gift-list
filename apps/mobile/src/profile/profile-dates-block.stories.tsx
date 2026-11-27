import type { Meta, StoryObj } from "@storybook/react";
import type { VisiblePersonalDate } from "@gift-list/contracts";
import { XStack } from "@gift-list/ui";
import { ProfileDatesBlock } from "./profile-dates-block";

const meta = {
  title: "App/ProfileDatesBlock",
  component: ProfileDatesBlock,
  tags: ["autodocs"],
  globals: { viewport: { value: "w360" } },
  args: {
    dates: [
      { id: "d1", kind: "CUSTOM", title: "Годовщина свадьбы", day: 14, month: 3, year: null },
      { id: "d2", kind: "CUSTOM", title: "День рождения мамы", day: 2, month: 9, year: 1958 },
    ],
  },
} satisfies Meta<typeof ProfileDatesBlock>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The block on a profile: a title and a date, a year only when the owner opened it. */
export const Playground: Story = {
  render: function BlockStory(args) {
    return (
      <XStack width={328} padding={16}>
        <ProfileDatesBlock {...args} />
      </XStack>
    );
  },
};

/** A long title at 360 px: the line wraps instead of clipping. */
export const LongTitle: Story = {
  tags: ["!dev"],
  args: {
    dates: [
      {
        id: "d1",
        kind: "CUSTOM",
        title: "Годовщина первой поездки в горы вместе",
        day: 28,
        month: 12,
        year: null,
      } satisfies VisiblePersonalDate,
    ],
  },
  render: function LongTitleStory(args) {
    return (
      <XStack width={328} padding={16}>
        <ProfileDatesBlock {...args} />
      </XStack>
    );
  },
};

/** No visible dates: the block draws nothing, so a stranger learns nothing. */
export const Empty: Story = {
  tags: ["!dev"],
  args: { dates: [] },
  render: function EmptyStory(args) {
    return (
      <XStack width={328} padding={16}>
        <ProfileDatesBlock {...args} />
      </XStack>
    );
  },
};
