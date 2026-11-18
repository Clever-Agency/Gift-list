import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import { FriendsTwoPane } from "./friends-two-pane";
import { PersonRow } from "./person-row";
import { StatusPill } from "./status-pill";
import { WishCard } from "./wish-card";

/**
 * The desktop Friends layout of v8 (variant D): the list with segments, search and
 * rows on the left, the selected friend's wishlist in a three-column grid on the
 * right. Purely presentational — the screen passes both panes; this component adds no
 * data, no selection and no route. A phone keeps the single-column list.
 */
const meta = {
  title: "UI/FriendsTwoPane",
  component: FriendsTwoPane,
  args: { list: null, detail: null },
} satisfies Meta<typeof FriendsTwoPane>;

export default meta;

type Story = StoryObj<typeof meta>;

const FRIENDS = [
  { name: "Александра Константинопольская", nick: "alexandra_konstantinopolskaya" },
  { name: "Аня Смирнова", nick: "anya" },
  { name: "Дмитрий Ковальчук-Воскресенский", nick: "dima_kovalchuk_v" },
  { name: "Марина Петрова", nick: "marina" },
];

/** The left pane as the screen draws it: plain rows with dividers and the ⋮ menu. */
function FriendsList() {
  return (
    <YStack role="list">
      {FRIENDS.map(function friend(item, index) {
        return (
          <YStack key={item.nick} borderTopWidth={index > 0 ? 1 : 0} borderColor="$border" paddingVertical="$1">
            <PersonRow displayName={item.name} nick={item.nick} variant="row" />
          </YStack>
        );
      })}
    </YStack>
  );
}

/** The right pane: the selected friend, the wishes tabs and the 3-column grid. */
function FriendWishlist() {
  return (
    <YStack gap="$grid-gap">
      <YStack gap="$1">
        <PersonRow
          displayName="Александра Константинопольская"
          nick="alexandra_konstantinopolskaya"
          variant="row"
        />
      </YStack>
      <YStack role="list" flexDirection="row" flexWrap="wrap" gap="$grid-gap">
        <WishCard
          title="Наушники с шумоподавлением"
          price="24 990 ₽"
          status={<StatusPill status="open" label="Свободно" />}
          width={210}
        />
        <WishCard
          title="Свеча «Ель и мандарин»"
          price="1 490 ₽"
          status={<StatusPill status="reserved" label="Забронировано" />}
          width={210}
        />
        <WishCard
          title="Сборник стихов"
          price="890 ₽"
          status={<StatusPill status="open" label="Свободно" />}
          width={210}
        />
      </YStack>
    </YStack>
  );
}

export const Desktop: Story = {
  render: function DesktopStory() {
    return <FriendsTwoPane list={<FriendsList />} detail={<FriendWishlist />} testID="friends-two-pane" />;
  },
};

/** No friend selected: the right pane shows the hint the screen passes. */
export const NothingSelected: Story = {
  render: function NothingSelectedStory() {
    return (
      <FriendsTwoPane
        list={<FriendsList />}
        empty={
          <YStack padding="$4" alignItems="center">
            Выберите друга, чтобы увидеть его вишлист
          </YStack>
        }
        testID="friends-two-pane-empty"
      />
    );
  },
};

/** At 1280 px the panes stand side by side with the column gap of the layout. */
export const Wide: Story = {
  render: function WideStory() {
    return <FriendsTwoPane list={<FriendsList />} detail={<FriendWishlist />} testID="friends-two-pane-wide" />;
  },
  globals: { viewport: { value: "w1280" } },
};
