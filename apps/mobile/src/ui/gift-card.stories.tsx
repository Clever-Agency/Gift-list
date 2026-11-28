import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import type { GiftCard as GiftCardData } from "@gift-list/contracts";
import { Pressable, Text, XStack } from "@gift-list/ui";
import { WishCard } from "./gift-card";

/**
 * The owner's gift card (AD-12, `DESIGN.md` → WishCard): title, price, status pill and
 * up to three tags with «+N». Only an `onPress` or `href` makes the card a target:
 * the app hands it the wish page `/gifts/{id}`, a real `<a href>` on the web
 * (CLE-129, T4.4). The stories use a fixture card: the server owns which fields a
 * viewer may see (`VisibilityPolicy`, AD-7).
 *
 * D-54: the card has no visibility chip: visibility changes only in the wish form.
 *
 * D-49 (CLE-124): the owner never sees a reservation, so the card has no
 * «Забронирован» pill, holder line or phase strip to show.
 */
const meta = {
  title: "App/WishCard",
  component: WishCard,
  tags: ["autodocs"],
  args: { gift: giftCard(), width: 328 },
} satisfies Meta<typeof WishCard>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

function giftCard(overrides: Partial<GiftCardData> = {}): GiftCardData {
  return {
    id: "gift-1",
    title: "Плед из шерсти мериноса",
    description: "Тёплый, 200 × 140, цвет — овсяный.",
    priceAmount: 250000,
    priceCurrency: "RUB",
    linkUrl: null,
    visibility: "PUBLIC",
    quantity: "SINGLE",
    expiresOn: null,
    archivedAt: null,
    tags: [
      { catalogId: "tag-home", label: "Дом" },
      { catalogId: "tag-cozy", label: "Уют" },
    ],
    status: "OPEN",
    reservedBy: null,
    reservationLabel: null,
    ownerAction: null,
    ...overrides,
  };
}

/** The card the list draws: a `listitem` inside the screen's list. */
function CardList({ children }: { children: ReactNode }) {
  return (
    <XStack role="list" gap="$3" flexWrap="wrap" width={328}>
      {children}
    </XStack>
  );
}

CardList.displayName = "CardList";

/** An open wish of the owner: the whole card opens the details. */
export const OwnerOpen: Story = {
  args: { onPress: noop },
  render: function OwnerOpenStory(args) {
    return (
      <CardList>
        <WishCard {...args} />
      </CardList>
    );
  },
};

/** A received wish: the card is muted and read-only. */
export const Received: Story = {
  tags: ["!dev"],
  args: {
    gift: giftCard({ status: "CLOSED", visibility: "PUBLIC" }),
  },
  render: function ReceivedStory(args) {
    return (
      <CardList>
        <WishCard {...args} />
      </CardList>
    );
  },
};

/**
 * An archived wish (`archivedAt` set): read-only as a whole (CLE-82/S23.3), with no
 * visibility chip, exactly like a received one.
 */
export const Archived: Story = {
  tags: ["!dev"],
  args: {
    gift: giftCard({ archivedAt: "2026-10-01T00:00:00.000Z", visibility: "SECRET" }),
  },
  render: function ArchivedStory(args) {
    return (
      <CardList>
        <WishCard {...args} />
      </CardList>
    );
  },
};

/** No price given: the line is absent, not an empty «0 ₽». */
export const WithoutPrice: Story = {
  tags: ["!dev"],
  args: { gift: giftCard({ priceAmount: null, priceCurrency: null }) },
  render: function WithoutPriceStory(args) {
    return (
      <CardList>
        <WishCard {...args} />
      </CardList>
    );
  },
};

/** More than three tags: the row shows three and the accessible name keeps all. */
export const ManyTags: Story = {
  tags: ["!dev"],
  args: {
    gift: giftCard({
      tags: [
        { catalogId: "tag-home", label: "Дом" },
        { catalogId: "tag-cozy", label: "Уют" },
        { catalogId: "tag-winter", label: "Зима" },
        { catalogId: "tag-gift", label: "Для сна" },
        { catalogId: null, label: "На день рождения" },
      ],
    }),
  },
  render: function ManyTagsStory(args) {
    return (
      <CardList>
        <WishCard {...args} />
      </CardList>
    );
  },
};

/** A long title and long tags at 360 px: two lines, then the ellipsis. */
export const LongCopyNarrow: Story = {
  tags: ["!dev"],
  args: {
    gift: giftCard({
      title: "Плед из шерсти мериноса с длинной бахромой и подогревом для холодных вечеров",
      tags: [
        { catalogId: "tag-home", label: "Дом" },
        { catalogId: null, label: "Для уютных вечеров вдвоём" },
        { catalogId: "tag-winter", label: "Зима" },
      ],
    }),
    onPress: noop,
  },
  render: function LongCopyNarrowStory(args) {
    return (
      <CardList>
        <WishCard {...args} />
      </CardList>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** The owner's ⋯: a sibling of the card button, a 44 × 44 control next to the title. */
function menuTrigger(): ReactNode {
  return (
    <Pressable
      role="button"
      aria-label="Меню: Плед из шерсти мериноса"
      onPress={noop}
      width="$touch-target"
      height="$touch-target"
      alignItems="center"
      justifyContent="center"
    >
      <Text aria-hidden>⋯</Text>
    </Pressable>
  );
}

/** An open wish with the owner's ⋯ (Story 5.3): «Отметить полученным» lives there. */
export const OwnerOpenWithMenu: Story = {
  args: { onPress: noop, menu: menuTrigger() },
  render: function OwnerOpenWithMenuStory(args) {
    return (
      <CardList>
        <WishCard {...args} />
      </CardList>
    );
  },
};

/** A received wish with the owner's ⋯: undo in the window, copy and delete. */
export const ReceivedWithMenu: Story = {
  tags: ["!dev"],
  args: {
    gift: giftCard({ status: "CLOSED" }),
    onPress: noop,
    menu: menuTrigger(),
  },
  render: function ReceivedWithMenuStory(args) {
    return (
      <CardList>
        <WishCard {...args} />
      </CardList>
    );
  },
};
