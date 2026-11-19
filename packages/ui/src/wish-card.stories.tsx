import type { Meta, StoryObj } from "@storybook/react";
import { XStack, YStack } from "@tamagui/stacks";
import { Pressable } from "./pressable";
import { WishCardSkeleton } from "./skeleton";
import { StatusPill } from "./status-pill";
import { TagChipList } from "./tag-chip";
import { Text } from "./text";
import { VisibilityChip } from "./visibility-chip";
import { WishCard } from "./wish-card";

/**
 * `WishCard` is the presentational gift card of v8: a vertical Pinterest card with a
 * 4:5 photo plate (the moon placeholder until a wish has a photo), the title and the
 * price under it on the page background, then the status pill, tags and the
 * reservation line. There is no frame around the cell and no text on the photo.
 *
 * With `onPress` the whole card is a button and the photo plate's shadow lifts on
 * hover; the visibility chip is a later sibling, never inside the button. The app
 * builds the status pill, the tag row and the chip.
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

/** The grid wrapper the app paints cards in: the card itself is a `listitem`. */
function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <XStack role="list" flexWrap="wrap" gap="$grid-gap" width={328}>
      {children}
    </XStack>
  );
}

CardGrid.displayName = "CardGrid";

export const Open: Story = {
  render: function OpenStory(args) {
    return (
      <CardGrid>
        <WishCard {...args} width="calc(50% - 8px)" />
      </CardGrid>
    );
  },
};

/** No photo yet: the v8 placeholder — a calm tinted plate with the moon, no text. */
export const NoPhotoPlaceholder: Story = {
  render: function NoPhotoPlaceholderStory(args) {
    return (
      <CardGrid>
        <WishCard {...args} width="calc(50% - 8px)" />
        <WishCard {...args} title="Настольная лампа" width="calc(50% - 8px)" />
      </CardGrid>
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
      <CardGrid>
        <WishCard {...args} width="calc(50% - 8px)" />
      </CardGrid>
    );
  },
};

/** A closed wish reads as muted all the way down; its status is «Получен». */
export const Closed: Story = {
  args: {
    closed: true,
    status: <StatusPill status="closed" label="Получен" />,
    reservation: null,
  },
  render: function ClosedStory(args) {
    return (
      <CardGrid>
        <WishCard {...args} width="calc(50% - 8px)" />
      </CardGrid>
    );
  },
};

/** Without a price: «Необязательная цена» — the card simply has one line fewer. */
export const WithoutPrice: Story = {
  args: { price: null },
  render: function WithoutPriceStory(args) {
    return (
      <CardGrid>
        <WishCard {...args} width="calc(50% - 8px)" />
      </CardGrid>
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
      <CardGrid>
        <WishCard {...args} width="calc(50% - 8px)" />
      </CardGrid>
    );
  },
};

/** The overflow trigger the app puts on an archived card: a 44 px target, a sibling of the card. */
const archiveMenu = (
  <Pressable
    aria-label="Меню"
    onPress={noop}
    width="$touch-target"
    height="$touch-target"
    alignItems="center"
    justifyContent="center"
  >
    <Text>⋯</Text>
  </Pressable>
);

/** The owner's card with the menu trigger in the top-right corner (Story 2.6). */
export const WithMenu: Story = {
  args: { menu: archiveMenu },
  render: function WithMenuStory(args) {
    return (
      <CardGrid>
        <WishCard {...args} width="calc(50% - 8px)" />
      </CardGrid>
    );
  },
};

/** An archived wish: muted (`closed`), read-only, only the menu stays active. */
export const ArchivedWithMenu: Story = {
  args: {
    closed: true,
    status: <StatusPill status="open" label="В архиве" />,
    reservation: null,
    menu: archiveMenu,
  },
  render: function ArchivedWithMenuStory(args) {
    return (
      <CardGrid>
        <WishCard {...args} width="calc(50% - 8px)" />
      </CardGrid>
    );
  },
};

/** Long Cyrillic title at 360 px: the menu trigger does not push the text sideways. */
export const ArchivedLongTitleNarrow: Story = {
  args: {
    closed: true,
    title: "Плед из шерсти мериноса с длинной бахромой и подогревом для холодных вечеров у камина",
    menu: archiveMenu,
  },
  render: function ArchivedLongTitleNarrowStory(args) {
    return (
      <CardGrid>
        <WishCard {...args} width="calc(50% - 8px)" />
      </CardGrid>
    );
  },
  globals: { viewport: { value: "w360" } },
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
      <CardGrid>
        <WishCard {...args} width="calc(50% - 8px)" />
      </CardGrid>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** The loading state has the same shape as the card: plate, two lines, chip footer. */
export const LoadingSkeleton: Story = {
  render: function LoadingSkeletonStory() {
    return (
      <CardGrid>
        <WishCardSkeleton width="calc(50% - 8px)" />
        <WishCardSkeleton width="calc(50% - 8px)" />
      </CardGrid>
    );
  },
};

/** Two columns at 360 px, the width the phone grid uses (`cardGrid`). */
export const PhoneGrid: Story = {
  render: function PhoneGridStory(args) {
    const cards = [
      { key: "open", status: <StatusPill status="open" label="Открыт" /> },
      { key: "reserved", status: <StatusPill status="reserved" label="Забронирован" /> },
    ];
    return (
      <CardGrid>
        {cards.map(function card(item) {
          return (
            <WishCard
              key={item.key}
              {...args}
              title={item.key === "open" ? "Плед из шерсти мериноса" : "Керамическая кружка"}
              status={item.status}
              width="calc(50% - 8px)"
            />
          );
        })}
      </CardGrid>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** Three columns from the `medium` breakpoint (a desktop window). */
export const DesktopGrid: Story = {
  render: function DesktopGridStory(args) {
    return (
      <YStack role="list" flexDirection="row" flexWrap="wrap" gap="$grid-gap" width={1072}>
        <WishCard {...args} width="calc(33.333% - 11px)" />
        <WishCard {...args} title="Керамическая кружка" width="calc(33.333% - 11px)" />
        <WishCard {...args} title="Настольная лампа" width="calc(33.333% - 11px)" />
      </YStack>
    );
  },
  globals: { viewport: { value: "w1280" } },
};
