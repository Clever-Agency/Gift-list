import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import { RelationshipChip } from "./relationship-chip";

/**
 * `RelationshipChip` is the static relation of a person row: «Друзья», «Зовёт в
 * друзья», «Ожидает ответа», «Это вы». It is not a button; `emphasis` marks the
 * relation that waits for an answer.
 */
const meta = {
  title: "UI/RelationshipChip",
  component: RelationshipChip,
  args: {
    label: "Друзья",
  },
} satisfies Meta<typeof RelationshipChip>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Friend: Story = {};

/** «Зовёт в друзья» is the one relation in the primary colour and 600. */
export const Emphasized: Story = {
  args: { label: "Зовёт в друзья", emphasis: true },
};

export const AllRelations: Story = {
  render: function AllRelationsStory() {
    return (
      <YStack gap="$2" alignItems="flex-start" width={360}>
        <RelationshipChip label="Друзья" />
        <RelationshipChip label="Зовёт в друзья" emphasis />
        <RelationshipChip label="Ожидает ответа" />
        <RelationshipChip label="Вы подписаны" />
        <RelationshipChip label="Подписан на вас" />
        <RelationshipChip label="Это вы" />
      </YStack>
    );
  },
};

/** A long relation at 360 px: the chip grows with the text. */
export const LongLabelNarrow: Story = {
  args: { label: "Взаимная подписка, запрос отправлен давно" },
  globals: { viewport: { value: "w360" } },
};
