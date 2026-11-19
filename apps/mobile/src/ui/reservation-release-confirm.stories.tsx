import type { Meta, StoryObj } from "@storybook/react";
import { ReservationReleaseConfirm } from "./reservation-release-confirm";

/**
 * Снятие своей брони (Story 5.2): confirm «Снять бронь? Подарок снова станет
 * открытым.». На 360 px — шторка снизу, на medium+ — диалог. «Отмена» — ghost,
 * «Снять бронь» — обычная кнопка: коралловый `destructive` только у владельца,
 * который снимает чужую бронь.
 */
const meta = {
  title: "App/ReservationReleaseConfirm",
  component: ReservationReleaseConfirm,
  parameters: { layout: "fullscreen" },
  globals: { viewport: { value: "w360" } },
  args: {
    open: true,
    onClose: function noop() {},
    onConfirm: function noop() {},
  },
} satisfies Meta<typeof ReservationReleaseConfirm>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Compact: Story = {};

/** Запрос снятия в полёте: обе кнопки заняты. */
export const Busy: Story = {
  args: { busy: true },
};

export const Medium: Story = {
  globals: { viewport: { value: "w1280" } },
};
