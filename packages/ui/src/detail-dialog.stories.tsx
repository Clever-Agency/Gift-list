import type { Meta, StoryObj } from "@storybook/react";
import { Button } from "./button";
import { DetailDialog, type DetailFactView } from "./detail-dialog";

/**
 * Подробности пожелания (CLE-84): диалог с именем желания. На compact он почти
 * на весь экран, на medium+ — до `detail-width`. Длинное тело прокручивается.
 * Наведите ничего не нужно: откройте story и пройдите Tab внутри диалога.
 */
const meta = {
  title: "UI/DetailDialog",
  component: DetailDialog,
  args: {
    open: true,
    title: "Плед из шерсти мериноса",
    closeLabel: "Закрыть",
    onClose: function noop() {},
  },
} satisfies Meta<typeof DetailDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

const facts: DetailFactView[] = [
  { id: "description", label: "Описание", value: "Тёплый, 200 × 140, цвет — овсяный." },
  { id: "price", label: "Цена", value: "2 500 ₽" },
  {
    id: "link",
    label: "Ссылка",
    value: "https://shop.example/pled",
    href: "https://shop.example/pled",
  },
  { id: "quantity", label: "Сколько раз можно дарить", value: "Один раз" },
  { id: "expires", label: "Актуально до", value: "31.12.2026" },
  { id: "tags", label: "Теги", value: "Дом, Уют" },
  { id: "status", label: "Статус", value: "Открыт" },
];

export const Guest: Story = {
  args: { facts },
};

export const Owner: Story = {
  args: {
    facts: [
      ...facts,
      { id: "visibility", label: "Кто видит", value: "Друзьям" },
      { id: "reservedBy", label: "Бронь", value: "Берёт Анна" },
    ],
    actions: <Button label="Изменить желание" variant="secondary" onPress={function noop() {}} />,
  },
};

export const Loading: Story = {
  args: { notice: "Загружаем желание" },
};

export const NetworkError: Story = {
  args: {
    notice: "Нет соединения. Попробуйте ещё раз.",
    retry: { label: "Повторить", onPress: function noop() {} },
  },
};

export const Unavailable: Story = {
  args: { notice: "Желание не найдено." },
};

/** Длинная кириллица: тело уходит в прокрутку, заголовок и «Закрыть» остаются. */
export const Long: Story = {
  args: {
    title: "Набор для каллиграфии с перьями и тушью ручной работы",
    facts: [
      {
        id: "description",
        label: "Описание",
        value:
          "Хочу набор с широкими перьями, тушью цвета сепии и плотной бумагой. Можно б/у в хорошем состоянии, без пятен и с целой коробкой. Если будет два размера перьев — ещё лучше, я как раз учусь писать длинные строки кириллицей.",
      },
      ...facts.slice(1),
    ],
  },
  globals: { viewport: { value: "w360" } },
};

export const Desktop: Story = {
  args: { facts },
  globals: { viewport: { value: "w1280" } },
};
