import type { Meta, StoryObj } from "@storybook/react";
import { ReserveConfirm } from "./reserve-confirm";

const meta = {
  title: "App/ReserveConfirm",
  component: ReserveConfirm,
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "w360" } },
} satisfies Meta<typeof ReserveConfirm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Normal: Story = {
  args: {
    open: true,
    title: "Наушники Sony WH-1000XM5",
    timeZone: "Europe/Moscow",
    onClose: () => {},
    onConfirm: () => {},
  },
};

export const Busy: Story = {
  args: {
    ...Normal.args,
    busy: true,
  },
};

/** Дата вне диапазона: ошибка под полем, кнопки ещё можно нажать. */
export const Error: Story = {
  args: {
    ...Normal.args,
    dateError: "Выберите дату не позже 18.12.2026.",
  },
};

/** Подтверждение уже ушло: кнопки недоступны. */
export const Disabled: Story = {
  args: {
    ...Normal.args,
    busy: true,
  },
};

export const LongTitle: Story = {
  args: {
    ...Normal.args,
    title:
      "Очень длинное название желания на кириллице для проверки переноса в шторке бронирования",
  },
};
