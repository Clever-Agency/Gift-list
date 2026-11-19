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

/** Владелец, чужая бронь: коралловая «Снять бронь» рядом с «Изменить желание». */
export const OwnerReserved: Story = {
  args: {
    viewer: "owner",
    snapshot: sample({
      visibility: "FRIENDS",
      status: "RESERVED",
      reservedBy: { id: "u2", nick: "anna", displayName: "Анна" },
      reservationLabel: "BOUGHT",
      ownerAction: "CONFIRM_GIVEN",
    }),
    onEdit: function edit() {},
    onRelease: function release() {},
  },
};

/** Шаг снятия без отметки дарителя: только вопрос и две кнопки. */
const RELEASE_STEP = {
  key: "release",
  title: "Снять бронь? Подарок снова станет открытым.",
  cancelLabel: "Отмена",
  confirmLabel: "Снять бронь",
  destructive: true,
  onConfirm: function confirm() {},
  onCancel: function cancel() {},
} satisfies WishDetailStep;

const BOUGHT_WARNING =
  "Даритель отметил, что подарок уже куплен. Если снять бронь, его может купить кто-то ещё";

/** The owner detail with a step: the screen owns both, the story only draws them. */
function releaseArgs(step: WishDetailStep) {
  return {
    viewer: "owner" as const,
    snapshot: sample({ visibility: "FRIENDS" as const, status: "RESERVED" as const }),
    onEdit: function edit() {},
    onRelease: function release() {},
    step,
  };
}

export const ReleaseStep: Story = {
  args: releaseArgs(RELEASE_STEP),
};

/** Шаг снятия, даритель отметил «Купил»: предупреждение в описании шага. */
export const ReleaseStepBought: Story = {
  args: releaseArgs({ ...RELEASE_STEP, body: BOUGHT_WARNING }),
};

/** Шаг снятия после Story 5.7: даритель отметил «Подарил». */
export const ReleaseStepGiven: Story = {
  args: releaseArgs({ ...RELEASE_STEP, body: "Даритель отметил, что уже вручил" }),
};

/** Подтверждение уже ушло: обе кнопки недоступны. */
export const ReleaseStepBusy: Story = {
  args: releaseArgs({ ...RELEASE_STEP, body: BOUGHT_WARNING, busy: true }),
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
