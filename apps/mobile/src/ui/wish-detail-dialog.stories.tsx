import type { Meta, StoryObj } from "@storybook/react";
import type { GiftCard } from "@gift-list/contracts";
import { WishDetailDialog, type WishDetailStep } from "./wish-detail-dialog";
import type { DetailLoadResult } from "./wish-detail-load";

/**
 * Подробности из карточки (CLE-84). Тексты из каталога. На 360 px диалог почти
 * на весь экран; длинное описание прокручивается. Состояния загрузки, сети и
 * «не найдено» не показывают поля.
 */
const meta = {
  title: "App/WishDetailDialog",
  component: WishDetailDialog,
  tags: ["autodocs"],
  parameters: {
    // The detail layer is almost the full screen and paints a scrim over the
    // document; on the Docs page every showcase runs in its own iframe, so an
    // open dialog cannot cover the description.
    docs: { story: { inline: false, iframeHeight: "640px" } },
  },
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

/** Владелец открытого желания: «Изменить желание» и «Отметить полученным». */
export const Owner: Story = {
  args: {
    viewer: "owner",
    snapshot: sample({ visibility: "SECRET" }),
    onEdit: function edit() {},
    onMarkReceived: function received() {},
  },
};

/** Владелец закрытого желания: «Изменить желание» нет, в окне отмены — возврат. */
export const OwnerClosedUndo: Story = {
  tags: ["!dev"],
  args: {
    viewer: "owner",
    snapshot: sample({
      status: "CLOSED",
      undoUntil: new Date(Date.now() + 7 * 60_000).toISOString(),
    }),
    onEdit: function edit() {},
    onUndoClose: function undo() {},
  },
};

/** Окно отмены вышло: у закрытого желания действий нет, только просмотр. */
export const OwnerClosedExpired: Story = {
  tags: ["!dev"],
  args: {
    viewer: "owner",
    snapshot: sample({
      status: "CLOSED",
      undoUntil: new Date(Date.now() - 60_000).toISOString(),
    }),
    onEdit: function edit() {},
    onUndoClose: function undo() {},
  },
};

/** Владелец открытого желания: рядом с «Изменить желание» — «Отметить полученным». */
export const OwnerOpenReceived: Story = {
  tags: ["!dev"],
  args: {
    viewer: "owner",
    snapshot: sample({ visibility: "FRIENDS" }),
    onEdit: function edit() {},
    onMarkReceived: function received() {},
  },
};

/** Story 5.3: шаг закрытия — тот же слой, фокус на «Отмене», кнопка не коралловая. */
const CLOSE_STEP = {
  key: "close",
  title: "Подарок «Плед из шерсти мериноса» получен?",
  cancelLabel: "Отмена",
  confirmLabel: "Подтвердить",
  onConfirm: function confirm() {},
  onCancel: function cancel() {},
} satisfies WishDetailStep;

/** Шаг закрытия поверх подробностей: вопрос и две кнопки. */
export const ReceivedStep: Story = {
  tags: ["!dev"],
  args: {
    viewer: "owner",
    snapshot: sample({ visibility: "FRIENDS" }),
    onEdit: function edit() {},
    onMarkReceived: function received() {},
    step: CLOSE_STEP,
  },
};

export const Loading: Story = {
  tags: ["!dev"],
  args: { load: hang },
};

export const NetworkError: Story = {
  tags: ["!dev"],
  args: { load: offline },
};

export const Unavailable: Story = {
  tags: ["!dev"],
  args: { load: missing },
};

export const Desktop: Story = {
  tags: ["!dev"],
  globals: { viewport: { value: "w1280" } },
};
