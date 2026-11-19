import type { Meta, StoryObj } from "@storybook/react";
import type { GiftCard } from "@gift-list/contracts";
import { CloseGiftConfirm } from "./close-gift-confirm";

/**
 * Story 5.3 (FR-32): подтверждение «Подарок «Y» получен?» перед закрытием.
 * Тело про бронь — только у забронированного желания; кнопка «Подтвердить»
 * обычная, не коралловая (`DESIGN.md` → Colors: `destructive` не для «закрыт»).
 * Фокус при открытии — на безопасной «Отмене».
 */
const meta = {
  title: "App/CloseGiftConfirm",
  component: CloseGiftConfirm,
  args: {
    gift: sample(),
    onConfirm: function confirm() {},
    onCancel: function cancel() {},
    onClosed: function closed() {},
  },
  globals: { viewport: { value: "w360" } },
} satisfies Meta<typeof CloseGiftConfirm>;

export default meta;

type Story = StoryObj<typeof meta>;

function sample(overrides: Partial<GiftCard> = {}): GiftCard {
  return {
    id: "gift-1",
    title: "Плед из шерсти мериноса",
    description: null,
    priceAmount: 250000,
    priceCurrency: "RUB",
    linkUrl: null,
    visibility: "PUBLIC",
    quantity: "SINGLE",
    expiresOn: null,
    archivedAt: null,
    tags: [],
    status: "OPEN",
    reservedBy: null,
    reservationLabel: null,
    ownerAction: null,
    ...overrides,
  };
}

/** Открытое желание: только вопрос и две кнопки. */
export const Received: Story = {};

/** Забронированное желание: тело говорит, что бронь закроется. */
export const ReceivedReserved: Story = {
  args: {
    gift: sample({
      status: "RESERVED",
      reservedBy: { id: "user-2", nick: "masha", displayName: "Маша" },
    }),
  },
};

/** Подтверждение уже ушло: «Подтвердить» занято, второго нажатия нет. */
export const ReceivedBusy: Story = {
  args: { busy: true },
};

/** Длинное название на 360 px: заголовок переносится внутри слоя. */
export const ReceivedNarrowLongTitle: Story = {
  args: {
    gift: sample({
      title: "Плед из шерсти мериноса с длинной бахромой и подогревом для холодных вечеров",
    }),
  },
  globals: { viewport: { value: "w360" } },
};

/** Слой закрыт: `gift: null` не оставляет диалога в дереве. */
export const Hidden: Story = {
  args: { gift: null },
};
