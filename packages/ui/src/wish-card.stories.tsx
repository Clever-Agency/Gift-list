import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import { StatusPill } from "./status-pill";
import { TagChipList } from "./tag-chip";
import { VisibilityChip } from "./visibility-chip";
import { WishCard } from "./wish-card";

/**
 * `WishCard` is the presentational gift card: the app builds the status pill, the
 * tag row and the visibility chip. With `onPress` the whole card is a button and
 * the border turns primary on hover; the chip is a later sibling, never inside it.
 */
const meta = {
  title: "UI/WishCard",
  component: WishCard,
  args: {
    title: "Плед из шерсти мериноса",
    price: "2 500 ₽",
    status: <StatusPill status="open" label="Открыт" />,
    tags: (
      <TagChipList
        labels={["мечта", "для дома"]}
        moreLabel={function moreLabel(count) {
          return `+${count}`;
        }}
      />
    ),
  },
} satisfies Meta<typeof WishCard>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

/** The list wrapper the app paints cards in: the card itself is a `listitem`. */
function CardList({ children }: { children: React.ReactNode }) {
  return (
    <YStack role="list" gap="$3" width={320}>
      {children}
    </YStack>
  );
}

CardList.displayName = "CardList";

export const Open: Story = {
  render: function OpenStory(args) {
    return (
      <CardList>
        <WishCard {...args} />
      </CardList>
    );
  },
};

/** A booked wish shows the reservation line in the reserved colour. */
export const Reserved: Story = {
  args: {
    status: <StatusPill status="reserved" label="Забронирован" />,
    reservation: "Бронирует Анна до 4 ноября",
  },
  render: function ReservedStory(args) {
    return (
      <CardList>
        <WishCard {...args} />
      </CardList>
    );
  },
};

/** A closed wish reads as muted all the way down. */
export const Closed: Story = {
  args: {
    closed: true,
    status: <StatusPill status="closed" label="Получен" />,
    reservation: null,
  },
  render: function ClosedStory(args) {
    return (
      <CardList>
        <WishCard {...args} />
      </CardList>
    );
  },
};

/** Without a price: «Необязательная цена» — the card simply has one line fewer. */
export const WithoutPrice: Story = {
  args: { price: null },
  render: function WithoutPriceStory(args) {
    return (
      <CardList>
        <WishCard {...args} />
      </CardList>
    );
  },
};

/** The owner's card: pressing the card opens it, the chip opens the visibility layer. */
export const OwnerWithChip: Story = {
  args: {
    onPress: noop,
    pressLabel: "Плед из шерсти мериноса, 2 500 ₽, Открыт, мечта, видимость всем",
    chip: <VisibilityChip tone="public" label="Всем" accessibilityLabel="Видимость: всем. Изменить" onPress={noop} />,
    chipInteractive: true,
  },
  render: function OwnerWithChipStory(args) {
    return (
      <CardList>
        <WishCard {...args} />
      </CardList>
    );
  },
};

/** A 120-character title clamps to two lines at 360 px; the card does not grow sideways. */
export const LongTitleNarrow: Story = {
  args: {
    title:
      "Плед из шерсти мериноса с длинной бахромой и подогревом для холодных вечеров у камина зимой",
    tags: (
      <TagChipList
        labels={["мечта", "очень длинный собственный тег владельца", "для дома", "на праздник"]}
        moreLabel={function moreLabel(count) {
          return `+${count}`;
        }}
      />
    ),
  },
  render: function LongTitleNarrowStory(args) {
    return (
      <YStack role="list" gap="$3" width={328}>
        <WishCard {...args} />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};
