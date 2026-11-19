import type { Meta, StoryObj } from "@storybook/react";
import type { ReservationCard as ReservationCardData } from "@gift-list/contracts";
import {
  ReservationsScreen,
  type ReservationsScreenProps,
  type ReservationsState,
} from "./reservations-screen";

/**
 * Экран «Мои брони» (Story 5.5): заголовок, карточки, пустое состояние, ошибка и
 * скелет загрузки. Экран рисует переданное состояние: запросы, сессию и слои
 * держит маршрут, поэтому каталог показывает его без сети.
 */
const meta = {
  title: "App/ReservationsScreen",
  component: ReservationsScreen,
  // Кадр каталога — сам экран: `Screen`/`SafeArea`/`PageScroll` занимают вьюпорт.
  parameters: { layout: "fullscreen", screenFrame: true },
  globals: { viewport: { value: "w360" } },
} satisfies Meta<typeof ReservationsScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

function card(overrides: Partial<ReservationCardData> = {}): ReservationCardData {
  return {
    giftId: "gift-1",
    titleSnapshot: "Плед из шерсти мериноса",
    status: "RESERVED",
    ownerNick: "anya",
    dueAt: "2026-12-01",
    phase: "ACTIVE",
    bought: false,
    holderVisibleToOwner: false,
    holderVisibleToOthers: true,
    canOpenGift: true,
    ...overrides,
  };
}

const ready = {
  status: "ready",
  reservations: [
    card(),
    card({
      giftId: "gift-2",
      titleSnapshot: "Свитер с оленями",
      ownerNick: "mira",
      dueAt: "2026-12-05",
      phase: "AWAITING_OWNER",
      bought: true,
    }),
    card({
      giftId: "gift-3",
      titleSnapshot: "Набор для каллиграфии",
      ownerNick: "olga",
      dueAt: "2026-12-09",
      phase: "GIVEN",
      canOpenGift: false,
    }),
  ],
} satisfies ReservationsState;

const base = {
  state: ready,
  expanded: new Set<string>(),
  busyIds: new Set<string>(),
  onRetry: noop,
  onBack: noop,
  onOpenGift: noop,
  onMenu: noop,
  onExtend: noop,
  onToggleVisibility: noop,
  onBoughtChange: noop,
  onVisibilityChange: noop,
} satisfies ReservationsScreenProps;

/** Список: три фазы, «Куплено», одна карточка без ссылки на деталь. */
export const List: Story = {
  args: base,
};

/** Пустой список: «Броней нет» и подсказка про «Куплю сам». */
export const Empty: Story = {
  args: { ...base, state: { status: "ready", reservations: [] } },
};

/** Обрыв сети: «Не получилось загрузить» и «Повторить». */
export const NetworkError: Story = {
  args: { ...base, state: { status: "error", kind: "network" } },
};

/** Загрузка: скелет карточек той же формы, что и список. */
export const Loading: Story = {
  args: { ...base, state: { status: "loading" } },
};

/** Широкая колонка: карточки тянутся по колонке страницы. */
export const Medium: Story = {
  args: base,
  globals: { viewport: { value: "w768" } },
};
