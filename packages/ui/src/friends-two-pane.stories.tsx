import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import type { ComponentType, ReactNode } from "react";
import { propDoc } from "../../../.storybook/argTypes";
import { FriendsTwoPane, type FriendsTwoPaneProps } from "./friends-two-pane";
import { PersonRow } from "./person-row";
import { StatusPill } from "./status-pill";
import { WishCard } from "./wish-card";

/**
 * The layout props plus the «есть выбранный» catalog handle. The panes are slots,
 * so the catalog keeps ready-made friends and wishes behind one switch instead of
 * node knobs. The cast on `component` is what lets the Docs controls see the
 * handle; the component itself stays unchanged.
 */
type FriendsTwoPaneCatalogProps = Omit<FriendsTwoPaneProps, "list"> & {
  list?: ReactNode;
  hasSelection?: boolean;
};

const FRIENDS = [
  { name: "Александра Константинопольская", nick: "alexandra_konstantinopolskaya" },
  { name: "Аня Смирнова", nick: "anya" },
  { name: "Дмитрий Ковальчук-Воскресенский", nick: "dima_kovalchuk_v" },
  { name: "Марина Петрова", nick: "marina" },
];

const WISHES = [
  { title: "Наушники с шумоподавлением", price: "24 990 ₽", status: "open" as const, label: "Свободно" },
  { title: "Свеча «Ель и мандарин»", price: "1 490 ₽", status: "reserved" as const, label: "Забронировано" },
  { title: "Сборник стихов", price: "890 ₽", status: "open" as const, label: "Свободно" },
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

FriendsList.displayName = "FriendsList";

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
        {WISHES.map(function wish(item) {
          return (
            <WishCard
              key={item.title}
              title={item.title}
              price={item.price}
              status={<StatusPill status={item.status} label={item.label} />}
              width={210}
            />
          );
        })}
      </YStack>
    </YStack>
  );
}

FriendWishlist.displayName = "FriendWishlist";

/** The hint of the right pane when no friend is picked. */
function EmptyHint() {
  return (
    <YStack padding="$4" alignItems="center">
      Выберите друга, чтобы увидеть его вишлист
    </YStack>
  );
}

EmptyHint.displayName = "EmptyHint";

/**
 * The desktop Friends layout of v8 (variant D): the list with segments, search and
 * rows on the left, the selected friend's wishlist in a three-column grid on the
 * right. Purely presentational — the screen passes both panes; this component adds
 * no data, no selection and no route. A phone keeps the single-column list.
 *
 * The sandbox flips «есть выбранный» between the selected friend's grid and the
 * hint of the empty right pane.
 */
const meta = {
  title: "UI/FriendsTwoPane",
  component: FriendsTwoPane as unknown as ComponentType<FriendsTwoPaneCatalogProps>,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The desktop layout of the Friends screen, variant D (\`blocks/07-friends.png\`): two panes side by side — the list on the left, the selected friend's wishlist on the right. It is used from the \`wide\` breakpoint; a phone keeps the single-column list.

What is not a prop:

- \`list\`, \`detail\` and \`empty\` are slots: the screen supplies both panes, so the layout adds no data fetching, no selection state and no routes of its own. The sandbox keeps ready-made panes behind «есть выбранный».
- \`listWidth\` is the width of the left pane; the right one takes the rest and keeps \`minWidth={0}\`, so a long wish title cannot push the layout sideways.
- When no friend is selected, the right pane shows \`empty\`; when one is, it shows \`detail\`.
        `.trim(),
      },
    },
  },
  argTypes: {
    list: propDoc({
      description:
        "The left pane: the segments, the search and the rows the screen already draws. The sandbox passes a ready-made list of friends.",
      type: "ReactNode",
      required: true,
      control: false,
    }),
    detail: propDoc({
      description:
        "The right pane: the selected friend's header and wish grid. The sandbox passes a ready-made grid under «есть выбранный».",
      type: "ReactNode",
      control: false,
    }),
    empty: propDoc({
      description:
        "Shown in the right pane when no friend is selected. The sandbox passes a ready-made hint.",
      type: "ReactNode",
      control: false,
    }),
    listWidth: propDoc({
      description:
        "The width of the left pane; the right one takes the rest. A number of pixels or a CSS size.",
      type: "number | string",
      control: "number",
      defaultValue: "320",
    }),
    testID: propDoc({
      description: "A stable handle for tests; reaches the web DOM as `data-testid`.",
      type: "string",
      control: "text",
    }),
    hasSelection: {
      name: "есть выбранный",
      description:
        "Ручка каталога: показать в правой панели готовый вишлист выбранного друга. Выключено — готовое пустое состояние.",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
    },
  },
  args: {
    listWidth: 320,
    testID: "friends-two-pane",
    hasSelection: true,
  },
} satisfies Meta<FriendsTwoPaneCatalogProps>;

export default meta;

type Story = StoryObj<typeof meta>;

function FriendsTwoPanePreview({
  hasSelection = false,
  list,
  detail,
  empty,
  ...layoutArgs
}: FriendsTwoPaneCatalogProps) {
  return (
    <FriendsTwoPane
      {...layoutArgs}
      list={list ?? <FriendsList />}
      detail={hasSelection ? (detail ?? <FriendWishlist />) : detail}
      empty={hasSelection ? empty : (empty ?? <EmptyHint />)}
    />
  );
}

FriendsTwoPanePreview.displayName = "FriendsTwoPanePreview";

/**
 * The sandbox: change the left-pane width and flip «есть выбранный» — the right
 * pane shows the ready-made wishlist or its empty hint. The panes are the
 * ready-made samples of the screen.
 */
export const Playground: Story = {
  render: function PlaygroundStory(args) {
    return <FriendsTwoPanePreview {...args} />;
  },
};

/** The two panes at 1280 px, with the selected friend's three-column wishlist. */
export const Desktop: Story = {
  args: { hasSelection: true },
  render: function DesktopStory() {
    return (
      <FriendsTwoPanePreview list={<FriendsList />} detail={<FriendWishlist />} testID="friends-two-pane" />
    );
  },
  globals: { viewport: { value: "w1280" } },
};

/** No friend selected: the right pane shows the hint the screen passes. */
export const NothingSelected: Story = {
  tags: ["!dev"],
  render: function NothingSelectedStory() {
    return (
      <FriendsTwoPanePreview
        hasSelection={false}
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
  tags: ["!dev"],
  args: { hasSelection: true },
  render: function WideStory() {
    return (
      <FriendsTwoPanePreview
        list={<FriendsList />}
        detail={<FriendWishlist />}
        testID="friends-two-pane-wide"
      />
    );
  },
  globals: { viewport: { value: "w1280" } },
};
