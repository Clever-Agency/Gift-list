import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import { OverflowMenu, type OverflowMenuItem } from "./overflow-menu";
import { PersonRow } from "./person-row";
import { RelationshipChip } from "./relationship-chip";
import { Text } from "./text";

function noop() {}

const items: OverflowMenuItem[] = [
  { key: "profile", label: "Открыть профиль", onPress: noop },
  { key: "cancel", label: "Отменить приглашение", onPress: noop },
  { key: "unsubscribe", label: "Отписаться", onPress: noop },
  { key: "block", label: "Заблокировать", onPress: noop, destructive: true },
];

/**
 * `DESIGN.md` → PersonRow / Мелкие элементы: the ⋯ trigger is 44 × 44 and opens
 * the `{components.user-menu}` bottom sheet with the person's name in the
 * heading. Destructive items are red and stay last, after the divider.
 */
const meta = {
  title: "UI/OverflowMenu",
  component: OverflowMenu,
  args: {
    label: "Действия: Алёна",
    title: "Алёна",
    items,
  },
} satisfies Meta<typeof OverflowMenu>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The trigger alone: the catalog story opens the real menu with a press. */
export const Trigger: Story = {};

/** The full person row the menu belongs to: the card is the link, ⋯ is a sibling. */
export const InPersonRow: Story = {
  render: function InPersonRowStory() {
    return (
      <YStack gap="$2" width={360} maxWidth="100%">
        <PersonRow
          displayName="Алёна"
          nick="alena"
          chip={<RelationshipChip label="Зовёт в друзья" emphasis />}
          actions={<OverflowMenu label="Действия: Алёна" title="Алёна" items={items} />}
          href="/u/alena"
          pressLabel="Открыть профиль: Алёна, @alena, Зовёт в друзья"
        />
        <Text kind="caption" tone="muted">
          Press ⋯ to open the menu; the card itself is the profile link.
        </Text>
      </YStack>
    );
  },
};

/** A closed menu with its real trigger: press ⋯ in the story to open it. */
export const ClosedWithTrigger: Story = {
  render: function ClosedWithTriggerStory() {
    return (
      <OverflowMenu
        label="Действия: Алёна"
        title="Алёна"
        items={items}
        testID="overflow-menu"
      />
    );
  },
};

/** Long Cyrillic name and a destructive item at 360 px: the sheet keeps the gutter. */
export const LongContentNarrow: Story = {
  render: function LongContentNarrowStory() {
    return (
      <YStack gap="$2" alignItems="flex-start">
        <OverflowMenu
          label="Действия: Александра-Екатерина Преображенская"
          title="Александра-Екатерина Преображенская"
          items={[
            { key: "profile", label: "Открыть профиль", onPress: noop },
            { key: "cancel", label: "Отменить приглашение", onPress: noop },
            {
              key: "block",
              label: "Заблокировать Александра-Екатерину",
              onPress: noop,
              destructive: true,
            },
          ]}
        />
        <Text kind="caption" tone="muted">
          Press ⋯ to open the menu.
        </Text>
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};
