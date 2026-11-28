import type { Meta, StoryObj } from "@storybook/react";
import type { EditorialCollectionSummary } from "@gift-list/contracts";
import { CollectionsScreen, type CollectionsState } from "./collections-screen";

/**
 * Экран «Подборки» (Story 10.1): сетка карточек, пустое состояние, ошибка и
 * скелет загрузки. Карточки — `CollectionCard`: две колонки до `bp-expanded`,
 * три от него. Экран рисует переданное состояние: запрос, сессию и переходы
 * держит маршрут, поэтому каталог показывает его без сети.
 */
const meta = {
  title: "App/CollectionsScreen",
  component: CollectionsScreen,
  tags: ["autodocs"],
  // Кадр каталога — сам экран: `Screen`/`SafeArea`/`PageScroll` занимают вьюпорт.
  parameters: { layout: "fullscreen", screenFrame: true },
  globals: { viewport: { value: "w360" } },
} satisfies Meta<typeof CollectionsScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

const collections: EditorialCollectionSummary[] = [
  {
    id: "c1",
    title: "Для рыбалки",
    description: "Идеи для тех, кто любит воду",
    coverImageUrl: null,
    itemCount: 12,
  },
  {
    id: "c2",
    title: "На Новый год",
    description: null,
    coverImageUrl: null,
    itemCount: 24,
  },
  {
    id: "c3",
    title: "Подарки для тех, кто всё уже купил и не знает, чего хочет",
    description: null,
    coverImageUrl: null,
    itemCount: 3,
  },
  {
    id: "c4",
    title: "Осенние тренды",
    description: null,
    coverImageUrl: null,
    itemCount: 8,
  },
];

const base = {
  state: { status: "ready", collections } satisfies CollectionsState,
  onRetry: noop,
  onOpen: noop,
};

/** Сетка: две колонки на 360 px, длинное название остаётся в одну строку. */
export const List: Story = {
  args: base,
};

/** Подборок нет: «Подборок пока нет» и подсказка, что скоро появятся идеи. */
export const Empty: Story = {
  args: { ...base, state: { status: "ready", collections: [] } },
};

/** Обрыв сети: «Не получилось загрузить» и «Повторить». */
export const NetworkError: Story = {
  tags: ["!dev"],
  args: { ...base, state: { status: "error", kind: "network" } },
};

/** Загрузка: скелет карточек той же формы, что и список. */
export const Loading: Story = {
  tags: ["!dev"],
  args: { ...base, state: { status: "loading" } },
};
