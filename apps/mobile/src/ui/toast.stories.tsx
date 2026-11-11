import type { Meta, StoryObj } from "@storybook/react";
import type { ReactNode } from "react";
import { Text, View, YStack } from "@gift-list/ui";
import { ToastHost } from "./toast";

/**
 * The app's toast host: one toast at a time, an error announced assertively and
 * kept until dismissed, an info toast hidden after `max(3000 мс, 60 мс × символ)`
 * (`DESIGN.md` → Toast, DECISION 2026-11-10). The countdown pauses while the toast
 * is hovered or one of its buttons has focus.
 *
 * The host calls `onDismiss` when the time is up; a screen unmounts it there. The
 * stories keep the toast mounted (dismiss does nothing) so the state stays visible.
 */
const meta = {
  title: "App/ToastHost",
  component: ToastHost,
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

/** A sticky bottom control lifts the toast above itself. */
export const AboveStickyButton: Story = {
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

/** The words the host renders, for the docs panel. */
export const CopyReference: Story = {
  render: function CopyReferenceStory() {
    return (
      <YStack gap="$1" width={328}>
        <Text kind="body">Не удалось сохранить желание. Попробуйте ещё раз.</Text>
        <Text kind="body">Желание сохранено</Text>
        <Text kind="body">Желание удалено · Отменить</Text>
        <Text kind="body">Нет сети. Попробуйте ещё раз.</Text>
      </YStack>
    );
  },
};
