import type { Meta, StoryObj } from "@storybook/react";
import {
  ReservationExtendDialog,
  type ReservationExtendDialogProps,
} from "./reservation-extend-dialog";

/**
 * «Продлить до…» (Story 5.5, `EXPERIENCE.md` → Reservation actions): дата в
 * диапазоне сегодня…сегодня+30 в поясе держателя, подпись «Не позже {max}»,
 * «Подтвердить» / «Отмена». На 360 px — шторка снизу, на medium+ — диалог.
 */
const meta = {
  title: "App/ReservationExtendDialog",
  component: ReservationExtendDialog,
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "w360" } },
} satisfies Meta<typeof ReservationExtendDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

const base = {
  open: true,
  timeZone: "Europe/Minsk",
  onClose: noop,
  onConfirm: noop,
} satisfies ReservationExtendDialogProps;

/** Обычный вид: выбран день по умолчанию, обе кнопки доступны. */
export const Compact: Story = {
  args: base,
};

/** Запрос в полёте: обе кнопки заняты, второй раз не отправляют. */
export const Busy: Story = {
  args: { ...base, busy: true },
};

/** День вне диапазона: текст сервера с его `max` под полем даты. */
export const DateOutOfRange: Story = {
  args: { ...base, dateError: "Выберите дату не позже 20.12.2026." },
};

/** Medium и шире: тот же шаг в диалоге по центру. */
export const Medium: Story = {
  args: base,
  globals: { viewport: { value: "w768" } },
};
