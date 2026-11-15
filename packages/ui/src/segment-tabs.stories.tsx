import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { YStack } from "@tamagui/stacks";
import { SegmentTabs, type SegmentTab } from "./segment-tabs";
import { Text } from "./text";

const tabs: SegmentTab[] = [
  { key: "friends", label: "Друзья" },
  { key: "subscriptions", label: "Подписки" },
  { key: "requests", label: "Запросы", badge: 3 },
];

function noop() {}

/**
 * `DESIGN.md` → Мелкие элементы: the segment is text `label`; the selected tab is
 * 600 with a 2 px `primary` underline. The arrows move between tabs, Home and End
 * jump to the ends. The count badge belongs to its tab and is read with its name.
 */
const meta = {
  title: "UI/SegmentTabs",
  component: SegmentTabs,
  args: {
    label: "Разделы друзей",
    tabs,
    value: "friends",
    onChange: noop,
  },
} satisfies Meta<typeof SegmentTabs>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The default: the first tab is selected. */
export const FriendsSelected: Story = {};

/** «Подписки» selected: the choice is remembered by the screen. */
export const SubscriptionsSelected: Story = {
  args: { value: "subscriptions" },
};

/** «Запросы» selected with the incoming badge. */
export const RequestsWithBadge: Story = {
  args: { value: "requests" },
};

/** A real state change: pressing a tab selects it, the arrows move the selection. */
function LiveSegmentStory() {
  const [value, setValue] = useState("friends");
  return (
    <YStack gap="$2" alignItems="flex-start">
      <SegmentTabs label="Разделы друзей" tabs={tabs} value={value} onChange={setValue} />
      <Text kind="caption" tone="muted">
        Selected: {value}
      </Text>
    </YStack>
  );
}

LiveSegmentStory.displayName = "LiveSegmentStory";

export const Live: Story = {
  render: LiveSegmentStory,
};

/** No badge (the subscriptions segment): only the labels. */
export const WithoutBadge: Story = {
  args: {
    tabs: [
      { key: "friends", label: "Друзья" },
      { key: "subscriptions", label: "Подписки" },
      { key: "requests", label: "Запросы" },
    ],
  },
};

/** Long Cyrillic labels at 360 px: the tabs wrap instead of clipping. */
export const LongLabelsNarrow: Story = {
  args: {
    tabs: [
      { key: "friends", label: "Друзья" },
      { key: "subscriptions", label: "Мои подписчики" },
      { key: "requests", label: "Запросы", badge: 12 },
    ],
  },
  globals: { viewport: { value: "w360" } },
};
