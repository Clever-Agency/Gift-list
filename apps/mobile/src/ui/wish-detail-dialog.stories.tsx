import type { Meta, StoryObj } from "@storybook/react";
import type { GiftCard } from "@gift-list/contracts";
import { WishDetailDialog } from "./wish-detail-dialog";
import type { DetailLoadResult } from "./wish-detail-load";

/**
 * Подробности из карточки (CLE-84). Тексты из каталога. На 360 px диалог почти
 * на весь экран; длинное описание прокручивается. Состояния загрузки, сети и
 * «не найдено» не показывают поля.
 */
const meta = {
  title: "App/WishDetailDialog",
  component: WishDetailDialog,
  args: {
    open: true,
    viewer: "guest",
    snapshot: sample(),
    onClose: function noop() {},
  },
  globals: { viewport: { value: "w360" } },
} satisfies Meta<typeof WishDetailDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

function sample(overrides: Partial<GiftCard> = {}): GiftCard {
  return {
    id: "gift-1",
    title: "Плед из шерсти мериноса",
    description:
      "Тёплый, 200 × 140, цвет — овсяный. Можно б/у в хорошем состоянии, без пятен. Если будет два размера — ещё лучше.",
    priceAmount: 250000,
    priceCurrency: "RUB",
    linkUrl: "https://shop.example/pled",
    visibility: "FRIENDS",
    quantity: "SINGLE",
    expiresOn: "2026-12-31",
    archivedAt: null,
    tags: [
      { catalogId: "home", label: "Дом" },
      { catalogId: "cozy", label: "Уют" },
    ],
    status: "OPEN",
    reservedBy: null,
    reservationLabel: null,
    ownerAction: null,
    ...overrides,
  };
}

function hang(): Promise<DetailLoadResult> {
  return new Promise(function neverSettle() {});
}

function offline(): Promise<DetailLoadResult> {
  return Promise.resolve({ ok: false, reason: "network" });
}

function missing(): Promise<DetailLoadResult> {
  return Promise.resolve({ ok: false, reason: "not_found" });
}

export const Guest: Story = {};

export const Owner: Story = {
  args: {
    viewer: "owner",
    snapshot: sample({
      visibility: "SECRET",
      status: "RESERVED",
      reservedBy: null,
      ownerAction: "EXPIRED_NO_REPLY",
    }),
    onEdit: function edit() {},
  },
};

export const Loading: Story = {
  args: { load: hang },
};

export const NetworkError: Story = {
  args: { load: offline },
};

export const Unavailable: Story = {
  args: { load: missing },
};

export const Desktop: Story = {
  globals: { viewport: { value: "w1280" } },
};
