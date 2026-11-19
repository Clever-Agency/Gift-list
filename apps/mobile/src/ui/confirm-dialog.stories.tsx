import type { Meta, StoryObj } from "@storybook/react";
import { ConfirmDialog } from "./confirm-dialog";

/**
 * The one dialog of a form (`DESIGN.md` → BottomSheet / Dialog), in two modes:
 * a confirmation (`alertdialog`, initial focus on «Отмена») and the discard step
 * inside the form («Сохранить» / «Не сохранять» / close cross). The confirmation is
 * coral (`confirmTone="destructive"`, the default) for a loss and a regular primary
 * button (`confirmTone="primary"`) for an action that loses nothing, e.g. closing a
 * wish. `visible={false}` renders nothing; `busy` disables the confirmation and drops
 * a second press in the same frame.
 */
const meta = {
  title: "App/ConfirmDialog",
  component: ConfirmDialog,
} satisfies Meta<typeof ConfirmDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

/** «Удалить «…»?» — the destructive confirmation, focus on the safe «Отмена». */
export const DeleteConfirm: Story = {
  args: {
    visible: true,
    title: "Удалить «Плед из шерсти мериноса»?",
    body: "Желание исчезнет из вишлиста. Это нельзя отменить.",
    confirmLabel: "Удалить",
    cancelLabel: "Отмена",
    onConfirm: noop,
    onCancel: noop,
    onClosed: noop,
  },
};

/** The request is running: the confirm is busy and a second press is dropped. */
export const DeleteBusy: Story = {
  args: {
    visible: true,
    title: "Удалить «Плед из шерсти мериноса»?",
    body: "Желание исчезнет из вишлиста. Это нельзя отменить.",
    confirmLabel: "Удаляем…",
    cancelLabel: "Отмена",
    busy: true,
    onConfirm: noop,
    onCancel: noop,
    onClosed: noop,
  },
};

/**
 * Narrowing the visibility of a reserved wish (CLE-82/S23.3): the same destructive
 * step says what the holder loses. «Отмена» keeps the visibility as it was.
 */
export const ReservationLossConfirm: Story = {
  args: {
    visible: true,
    title: "Бронирующий потеряет доступ, бронь снимется",
    confirmLabel: "Подтвердить",
    cancelLabel: "Отмена",
    onConfirm: noop,
    onCancel: noop,
    onClosed: noop,
  },
};

/** The same step while the single PATCH runs: the confirmation is busy. */
export const ReservationLossBusy: Story = {
  args: {
    visible: true,
    title: "Бронирующий потеряет доступ, бронь снимется",
    confirmLabel: "Подтвердить",
    cancelLabel: "Отмена",
    busy: true,
    onConfirm: noop,
    onCancel: noop,
    onClosed: noop,
  },
};

/** The same step at 360 px: the sentence wraps inside the layer, nothing is clipped. */
export const ReservationLossNarrow: Story = {
  args: {
    visible: true,
    title: "Бронирующий потеряет доступ, бронь снимется",
    confirmLabel: "Подтвердить",
    cancelLabel: "Отмена",
    onConfirm: noop,
    onCancel: noop,
    onClosed: noop,
  },
  globals: { viewport: { value: "w360" } },
};

/**
 * Closing a wish (Story 5.3): the confirmation is a regular primary button —
 * `DESIGN.md` → Colors keeps `destructive` for losses and excludes «закрыт». With a
 * reservation the body says the booking closes and the holder is notified; the
 * default focus on the safe «Отмена» stays.
 */
export const CloseWishConfirm: Story = {
  args: {
    visible: true,
    title: "Подарок «Плед из шерсти мериноса» получен?",
    body: "Бронь будет закрыта, бронировавший получит уведомление",
    confirmLabel: "Подтвердить",
    cancelLabel: "Отмена",
    confirmTone: "primary",
    onConfirm: noop,
    onCancel: noop,
    onClosed: noop,
  },
};

/** The same close step at 360 px: the title and the body wrap inside the layer. */
export const CloseWishNarrow: Story = {
  args: {
    visible: true,
    title: "Подарок «Плед из шерсти мериноса с длинной бахромой и подогревом» получен?",
    body: "Бронь будет закрыта, бронировавший получит уведомление",
    confirmLabel: "Подтвердить",
    cancelLabel: "Отмена",
    confirmTone: "primary",
    onConfirm: noop,
    onCancel: noop,
    onClosed: noop,
  },
  globals: { viewport: { value: "w360" } },
};

/** The discard step of the form: save, give the draft up, or go back with the cross. */
export const DiscardChanges: Story = {
  args: {
    variant: "discard",
    visible: true,
    title: "Сохранить изменения?",
    confirmLabel: "Сохранить",
    declineLabel: "Не сохранять",
    closeLabel: "Закрыть",
    onConfirm: noop,
    onDecline: noop,
    onClose: noop,
    onClosed: noop,
  },
};

/** Long Cyrillic title and body at 360 px: the layer keeps the gutter and wraps. */
export const LongTitleNarrow: Story = {
  args: {
    visible: true,
    title: "Удалить «Плед из шерсти мериноса с длинной бахромой и подогревом»?",
    body: "Желание исчезнет из вишлиста вместе с тегами и бронью. Это нельзя отменить.",
    confirmLabel: "Удалить",
    cancelLabel: "Отмена",
    onConfirm: noop,
    onCancel: noop,
    onClosed: noop,
  },
  globals: { viewport: { value: "w360" } },
};

/** The closed state with its trigger: the dialog leaves no trace in the tree. */
export const Closed: Story = {
  args: {
    visible: false,
    title: "Удалить «Плед из шерсти мериноса»?",
    body: "Желание исчезнет из вишлиста. Это нельзя отменить.",
    confirmLabel: "Удалить",
    cancelLabel: "Отмена",
    onConfirm: noop,
    onCancel: noop,
    onClosed: noop,
  },
};
