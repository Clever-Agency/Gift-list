import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import type { GiftCard as GiftCardData } from "@gift-list/contracts";
import { XStack } from "@gift-list/ui";
import { WishCard } from "./gift-card";

/**
 * The owner's gift card (AD-12, `DESIGN.md` → WishCard): title, price, status pill,
 * up to three tags with «+N», the reservation line and the interactive visibility
 * chip. Only an `onPress` makes the card a button; the chip is pressable on an
 * `OPEN` or `RESERVED` wish and read-only on a closed or archived one. The stories
 * use a fixture card: the server owns which fields a viewer may see
 * (`VisibilityPolicy`, AD-7), and the card just draws them.
 */
const meta = {
  title: "App/WishCard",
  component: WishCard,
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

/** An open wish of the owner: the card is a button, the chip opens the picker. */
export const OwnerOpen: Story = {
  args: { onPress: noop, onVisibilityPress: noop },
  render: function OwnerOpenStory(args) {
    return (
      <CardList>
        <WishCard {...args} />
      </CardList>
    );
  },
};

/**
 * A reserved wish of the owner: the card is a button, the chip opens the picker
 * (CLE-82/S23.3), and the reservation line names the holder.
 */
export const ReservedWithHolder: Story = {
  args: {
    gift: giftCard({
      status: "RESERVED",
      visibility: "FRIENDS",
      reservedBy: { id: "user-2", nick: "masha", displayName: "Маша" },
    }),
    onPress: noop,
    onVisibilityPress: noop,
  },
  render: function ReservedWithHolderStory(args) {
    return (
      <CardList>
        <WishCard {...args} />
      </CardList>
    );
  },
};

/** The holder marked it given: the phase label replaces the holder's name. */
export const AwaitingConfirmation: Story = {
  args: { gift: giftCard({ status: "RESERVED", ownerAction: "CONFIRM_GIVEN" }) },
  render: function AwaitingConfirmationStory(args) {
    return (
      <CardList>
        <WishCard {...args} />
      </CardList>
    );
  },
};

/** The reservation ran out: the owner can see the expired phase. */
export const ExpiredReservation: Story = {
  args: { gift: giftCard({ status: "RESERVED", ownerAction: "EXPIRED_NO_REPLY" }) },
  render: function ExpiredReservationStory(args) {
    return (
      <CardList>
        <WishCard {...args} />
      </CardList>
    );
  },
};

/** A received wish: the card is muted, and the chip stays read-only even with a handler. */
export const Received: Story = {
  args: {
    gift: giftCard({ status: "CLOSED", visibility: "PUBLIC" }),
    onVisibilityPress: noop,
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
 * An archived wish (`archivedAt` set): read-only as a whole (CLE-82/S23.3), so the chip
 * only shows the stored visibility, exactly like a received one.
 */
export const Archived: Story = {
  args: {
    gift: giftCard({ archivedAt: "2026-10-01T00:00:00.000Z", visibility: "SECRET" }),
    onVisibilityPress: noop,
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
    onVisibilityPress: noop,
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
