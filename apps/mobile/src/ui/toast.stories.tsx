import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { View, YStack } from "@gift-list/ui";
import { ToastHost } from "./toast";

/**
 * The app's toast host: one toast at a time, an error announced assertively and
 * kept until dismissed, an info toast hidden after `max(3000 мс, 60 мс × символ)`
 * (`DESIGN.md` → Toast, DECISION 2026-11-10). The countdown pauses while the toast
 * is hovered or a person put focus on one of its buttons; the focus the screen moves
 * onto «Отменить» itself does not pause it. A screen that knows the life of one
 * toast itself passes `durationMs` (the undo toast of a closed wish lives 10 s) and
 * `actionRef` to move focus onto its action.
 *
 * The host calls `onDismiss` when the time is up; a screen unmounts it there. The
 * stories keep the toast mounted (dismiss does nothing) so the state stays visible.
 */
const meta = {
  title: "App/ToastHost",
  component: ToastHost,
  tags: ["autodocs"],
  args: {
    message: "Не удалось сохранить желание. Попробуйте ещё раз.",
    tone: "error",
    onDismiss: noop,
  },
} satisfies Meta<typeof ToastHost>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

/** The frame the app mounts the host in: the toast floats above the content. */
function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <View position="relative" width={328} height={220} backgroundColor="$background" overflow="hidden">
      {children}
    </View>
  );
}

PhoneFrame.displayName = "PhoneFrame";

/** An error stays until the user closes it: «Нет сети» must not vanish. */
export const ErrorStays: Story = {
  render: function ErrorStaysStory(args) {
    return (
      <PhoneFrame>
        <ToastHost {...args} />
      </PhoneFrame>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** A confirmation: polite announcement and a countdown, then it hides itself. */
export const Info: Story = {
  tags: ["!dev"],
  args: { tone: "info", message: "Желание сохранено" },
  render: function InfoStory(args) {
    return (
      <PhoneFrame>
        <ToastHost {...args} />
      </PhoneFrame>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** An undo toast: the action and the close button share the 44 px zone. */
export const WithUndoAction: Story = {
  args: {
    tone: "info",
    message: "Желание удалено",
    action: { label: "Отменить", onPress: noop },
  },
  render: function WithUndoActionStory(args) {
    return (
      <PhoneFrame>
        <ToastHost {...args} />
      </PhoneFrame>
    );
  },
  play: focusUndo,
  globals: { viewport: { value: "w360" } },
};

/** Focus and hover pause the countdown; the ring on the dark surface is `ring-inverse`. */
function focusUndo({ canvasElement }: { canvasElement: HTMLElement }) {
  const action = canvasElement.querySelector<HTMLElement>("[aria-label='Отменить']");
  action?.focus();
}

/**
 * The undo toast of a closed wish (Story 5.3): «Отмечено полученным · Отменить».
 * The screen passes `durationMs` — `DESIGN.md` gives the undo toast 10 s whatever the
 * message length — and `actionRef`, so focus lands on «Отменить» right after the wish
 * is closed (`DESIGN.md` → «Куда уходит фокус», пункт «а»). Hover and the focus a
 * person sets pause the countdown; the focus the screen moved itself does not, so the
 * toast is gone in 10 s. A screen reader holds a toast with an action on a phone; the
 * web cannot tell a reader from silence, so there the countdown runs.
 */
export const ClosedUndo: Story = {
  tags: ["!dev"],
  args: {
    tone: "success",
    message: "Отмечено полученным",
    action: { label: "Отменить", onPress: noop },
    durationMs: 10_000,
  },
  render: function ClosedUndoStory(args) {
    return (
      <PhoneFrame>
        <ToastHost {...args} />
      </PhoneFrame>
    );
  },
  play: focusUndo,
  globals: { viewport: { value: "w360" } },
};

/** A sticky bottom control lifts the toast above itself. */
export const AboveStickyButton: Story = {
  tags: ["!dev"],
  args: { tone: "info", message: "Ссылка скопирована", offsetBottom: 64 },
  render: function AboveStickyButtonStory(args) {
    return (
      <YStack width={328} gap="$2">
        <View position="relative" height={180} backgroundColor="$background" />
        <ToastHost {...args} />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** A long message with a retry at 360 px: the text wraps, the buttons stay 44 × 44. */
export const LongMessageNarrow: Story = {
  tags: ["!dev"],
  args: {
    tone: "error",
    message:
      "Не удалось забронировать желание: его только что забронировал другой человек. Обновите список.",
    action: { label: "Повторить", onPress: noop },
  },
  render: function LongMessageNarrowStory(args) {
    return (
      <PhoneFrame>
        <ToastHost {...args} />
      </PhoneFrame>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** An info toast that stays until dismissed: the screen passes `persistent`. */
export const PersistentInfo: Story = {
  tags: ["!dev"],
  args: { tone: "info", message: "Подключение восстановлено", persistent: true },
  render: function PersistentInfoStory(args) {
    return (
      <PhoneFrame>
        <ToastHost {...args} />
      </PhoneFrame>
    );
  },
  globals: { viewport: { value: "w360" } },
};
