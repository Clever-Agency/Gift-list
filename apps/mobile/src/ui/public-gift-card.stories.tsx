import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import type { GiftCard as GiftCardData } from "@gift-list/contracts";
import { XStack } from "@gift-list/ui";
import { PublicGiftCard } from "./public-gift-card";

/**
 * The card a link visitor sees on `/l/{token}` (Story 3.3): the same
 * `packages/ui` card, without the visibility chip and without a press zone — a
 * visitor cannot open a wish or change anything. The server has already applied
 * `VisibilityPolicy` (AD-7): whatever arrives in `gift` is allowed for this viewer,
 * so the card never inspects `visibility`.
 */
const meta = {
  title: "App/PublicGiftCard",
  component: PublicGiftCard,
  args: { gift: publicGift(), width: 328 },
} satisfies Meta<typeof PublicGiftCard>;

export default meta;

type Story = StoryObj<typeof meta>;

function publicGift(overrides: Partial<GiftCardData> = {}): GiftCardData {
  return {
    id: "gift-public-1",
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

/** The visitor's list frame: `list` semantics, `listitem` per card. */
function PublicList({ children }: { children: ReactNode }) {
  return (
    <XStack role="list" gap="$3" flexWrap="wrap" width={328}>
      {children}
    </XStack>
  );
}

PublicList.displayName = "PublicList";

/** An open wish: title, price, status and tags, nothing to press. */
export const Open: Story = {
  render: function OpenStory(args) {
    return (
      <PublicList>
        <PublicGiftCard {...args} />
      </PublicList>
    );
  },
};

/** A reserved wish: the visitor sees the holder's shared name. */
export const Reserved: Story = {
  args: {
    gift: publicGift({
      status: "RESERVED",
      reservedBy: { id: "user-2", nick: "masha", displayName: "Маша" },
    }),
  },
  render: function ReservedStory(args) {
    return (
      <PublicList>
        <PublicGiftCard {...args} />
      </PublicList>
    );
  },
};

/** A received wish stays visible on a public list, muted. */
export const Received: Story = {
  args: { gift: publicGift({ status: "CLOSED" }) },
  render: function ReceivedStory(args) {
    return (
      <PublicList>
        <PublicGiftCard {...args} />
      </PublicList>
    );
  },
};

/** The server hid the holder's name: only the status pill labels the wish. */
export const ReservedNameHidden: Story = {
  args: { gift: publicGift({ status: "RESERVED", reservedBy: null }) },
  render: function ReservedNameHiddenStory(args) {
    return (
      <PublicList>
        <PublicGiftCard {...args} />
      </PublicList>
    );
  },
};

/** More than three tags collapse into «+N», like on the owner's card. */
export const ManyTags: Story = {
  args: {
    gift: publicGift({
      tags: [
        { catalogId: "tag-home", label: "Дом" },
        { catalogId: "tag-cozy", label: "Уют" },
        { catalogId: "tag-winter", label: "Зима" },
        { catalogId: null, label: "На день рождения" },
      ],
    }),
  },
  render: function ManyTagsStory(args) {
    return (
      <PublicList>
        <PublicGiftCard {...args} />
      </PublicList>
    );
  },
};

/** A long title and long tags at 360 px: the visitor's card wraps like the owner's. */
export const LongCopyNarrow: Story = {
  args: {
    gift: publicGift({
      title: "Плед из шерсти мериноса с длинной бахромой и подогревом для холодных вечеров",
      tags: [
        { catalogId: "tag-home", label: "Дом" },
        { catalogId: null, label: "Для уютных вечеров вдвоём" },
      ],
    }),
  },
  render: function LongCopyNarrowStory(args) {
    return (
      <PublicList>
        <PublicGiftCard {...args} />
      </PublicList>
    );
  },
  globals: { viewport: { value: "w360" } },
};
