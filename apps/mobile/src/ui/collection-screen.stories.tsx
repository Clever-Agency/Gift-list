import type { Meta, StoryObj } from "@storybook/react";
import type { EditorialCollectionDetail } from "@gift-list/contracts";
import { CollectionScreen, type CollectionState } from "./collection-screen";

/**
 * Экран одной подборки (Story 10.1): заголовок, описание и идеи с кнопкой
 * «Добавить в мой вишлист». После успеха кнопка читает «Добавлено» и остаётся
 * недоступной на время этого захода. Экран рисует переданное состояние:
 * запрос, сессию, добавление и toast держит маршрут.
 */
const meta = {
  title: "App/CollectionScreen",
  component: CollectionScreen,
  tags: ["autodocs"],
  parameters: { layout: "fullscreen", screenFrame: true },
  globals: { viewport: { value: "w360" } },
} satisfies Meta<typeof CollectionScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

const collection: EditorialCollectionDetail = {
  id: "c1",
  title: "Для рыбалки",
  description: "Идеи для тех, кто любит воду и долгие вечера у костра.",
  coverImageUrl: null,
  itemCount: 3,
  items: [
    {
      id: "i1",
      title: "Термос",
      description: "Держит тепло сутки, крышка становится кружкой.",
      linkUrl: "https://shop.example/termos",
      imageUrl: null,
    },
    {
      id: "i2",
      title: "Складной нож",
      description: null,
      linkUrl: null,
      imageUrl: null,
    },
    {
      id: "i3",
      title: "Плед из шерсти мериноса",
      description: "Тёплый, но лёгкий — удобно взять с собой.",
      linkUrl: null,
      imageUrl: null,
    },
  ],
};

const base = {
  state: { status: "ready", collection } satisfies CollectionState,
  addedIds: new Set<string>(),
  busyIds: new Set<string>(),
  onRetry: noop,
  onAdd: noop,
};

/** Список идей: название, описание, ссылка и «Добавить в мой вишлист». */
export const List: Story = {
  args: base,
};

/** Идея уже добавлена: кнопка «Добавлено» недоступна. */
export const Added: Story = {
  args: { ...base, addedIds: new Set<string>(["i1"]) },
};

/** Загрузка: скелет карточек той же формы, что и список. */
export const Loading: Story = {
  tags: ["!dev"],
  args: { ...base, state: { status: "loading" } },
};

/** Обрыв сети: «Не получилось загрузить» и «Повторить». */
export const NetworkError: Story = {
  tags: ["!dev"],
  args: { ...base, state: { status: "error", kind: "network" } },
};

/** Черновик или несуществующая подборка: общая страница «не найдено». */
export const NotFound: Story = {
  tags: ["!dev"],
  args: { ...base, state: { status: "missing" } },
};
