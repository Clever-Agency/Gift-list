import type { Meta, StoryObj } from "@storybook/react";
import {
  ReservationExtendDialog,
  addCalendarDays,
  extendBounds,
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
  tags: ["autodocs"],
  parameters: {
    layout: "fullscreen",
    // The layer paints a scrim over the whole document; on the Docs page every
    // showcase runs in its own iframe, so an open step stays inside its frame.
    docs: { story: { inline: false, iframeHeight: "560px" } },
  },
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
  tags: ["!dev"],
  args: { ...base, busy: true },
};

/**
 * Продление уже идущей брони: по умолчанию подставлен её текущий срок (он позже
 * «сегодня + 7»), поэтому «Подтвердить» без правки не сокращает бронь.
 */
export const CurrentDue: Story = {
  tags: ["!dev"],
  args: { ...base, currentDueOn: addCalendarDays(extendBounds("Europe/Minsk").minDue, 14) },
};

/** День вне диапазона: текст сервера с его `max` под полем даты. */
export const DateOutOfRange: Story = {
  tags: ["!dev"],
  args: { ...base, dateError: "Выберите дату не позже 20.12.2026." },
};

/** Medium и шире: тот же шаг в диалоге по центру. */
export const Medium: Story = {
  tags: ["!dev"],
  args: base,
  globals: { viewport: { value: "w768" } },
};
