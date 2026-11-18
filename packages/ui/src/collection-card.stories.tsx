import type { Meta, StoryObj } from "@storybook/react";
import { XStack } from "@tamagui/stacks";
import { CollectionCard } from "./collection-card";

/**
 * The editorial collection card of v8 (variant A): a tall 3:4 cover with the card
 * shadow, and the title and idea count below it on the page background — never on the
 * photo. Without a cover the plate stays a calm tint with the moon mark.
 */
const meta = {
  title: "UI/CollectionCard",
  component: CollectionCard,
  args: {
    title: "На Новый год",
    count: "24 идеи",
    width: 150,
  },
} satisfies Meta<typeof CollectionCard>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

export const Default: Story = {};

/** A pressable collection: the whole card opens it. */
export const Pressable: Story = {
  args: { onPress: noop, pressLabel: "На Новый год, 24 идеи" },
};

/** A long title clamps to one line; the count keeps its own line. */
export const LongTitle: Story = {
  args: { title: "Подарки для тех, кто всё уже купил и не знает, чего хочет", count: "128 идей" },
};

/** The row the section draws: 3:4 covers of one width and one gap. */
export const Row: Story = {
  render: function RowStory() {
    const collections = [
      { title: "На Новый год", count: "24 идеи" },
      { title: "Осенние тренды", count: "18 идей" },
      { title: "Женские штучки", count: "30 идей" },
      { title: "До 3 000 ₽", count: "40 идей" },
    ];
    return (
      <XStack gap={14}>
        {collections.map(function collection(item) {
          return (
            <CollectionCard key={item.title} title={item.title} count={item.count} width={150} />
          );
        })}
      </XStack>
    );
  },
};

/** At 360 px two cards fit with the page gutter and the third peeks in. */
export const Narrow: Story = {
  render: function NarrowStory() {
    return (
      <XStack gap={14}>
        <CollectionCard title="На Новый год" count="24 идеи" width={150} />
        <CollectionCard title="Осенние тренды" count="18 идей" width={150} />
        <CollectionCard title="Женские штучки" count="30 идей" width={150} />
      </XStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};
