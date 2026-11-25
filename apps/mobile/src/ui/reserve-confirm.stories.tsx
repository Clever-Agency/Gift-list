import type { Meta, StoryObj } from "@storybook/react";
import { ReserveConfirm } from "./reserve-confirm";

/**
 * Подтверждение брони (`EXPERIENCE.md` → Reserve confirm, `DESIGN.md` → ReserveConfirm):
 * дата в поясе держателя, под ней — строка о снятии через 7 дней, переключатель
 * «Показать другим, кто берёт» и «Подтвердить» / «Отмена». На 360 px это шторка
 * снизу, на medium и шире — диалог по центру; содержимое одно и то же.
 *
 * Слой рисует подложку на весь документ, поэтому на Docs каждый кадр идёт в
 * своём iframe (`docs.story.inline: false`) и не накрывает описание страницы.
 */
const meta = {
  title: "App/ReserveConfirm",
  component: ReserveConfirm,
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    docs: { story: { inline: false, iframeHeight: "560px" } },
  },
  globals: { viewport: { value: "w360" } },
} satisfies Meta<typeof ReserveConfirm>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Обычный шаг: подставлена дата по умолчанию, обе кнопки доступны. */
export const Normal: Story = {
  args: {
    open: true,
    title: "Наушники Sony WH-1000XM5",
    timeZone: "Europe/Moscow",
    onClose: () => {},
    onConfirm: () => {},
  },
};

/** Дата вне диапазона: ошибка под полем, кнопки ещё можно нажать. */
export const Error: Story = {
  args: {
    ...Normal.args,
    dateError: "Выберите дату не позже 18.12.2026.",
  },
};

/** Подтверждение уже ушло: обе кнопки заняты и второй раз не отправляют. */
export const Busy: Story = {
  tags: ["!dev"],
  args: {
    ...Normal.args,
    busy: true,
  },
};

/** Длинное название на кириллице: заголовок шторки переносится, а не обрезается. */
export const LongTitle: Story = {
  tags: ["!dev"],
  args: {
    ...Normal.args,
    title:
      "Очень длинное название желания на кириллице для проверки переноса в шторке бронирования",
  },
};
