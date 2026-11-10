import type { Meta, StoryObj } from "@storybook/react";
import { Text } from "./text";
import { Toast } from "./toast";
import { View } from "./layout";

/**
 * `Toast` is the look of a toast; the host decides when to show and hide it. An
 * error is announced assertively, an info toast politely, and the overlay lets
 * touches through. It fades in and out with `quick` (160 ms, `DESIGN.md` →
 * Движение); with «уменьшить движение» the fade is 100 ms and there is no shift.
 * The stories put the absolutely positioned toast in a phone frame so it sits
 * where the app draws it.
 */
const meta = {
  title: "UI/Toast",
  component: Toast,
  args: {
    message: "Не удалось сохранить желание. Попробуйте ещё раз.",
    tone: "error",
    closeLabel: "Закрыть",
    onClose: noop,
  },
} satisfies Meta<typeof Toast>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

/** The phone frame the host mounts the toast in. */
function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <View position="relative" width={360} height={220} backgroundColor="$background" overflow="hidden">
      {children}
    </View>
  );
}

PhoneFrame.displayName = "PhoneFrame";

/** `error` (the default): a red surface with an assertive announcement. */
export const Error: Story = {
  render: function ErrorStory(args) {
    return (
      <PhoneFrame>
        <Toast {...args} onClose={noop} />
      </PhoneFrame>
    );
  },
};

/** `info`: a dark surface with a polite announcement, e.g. «Желание сохранено». */
export const Info: Story = {
  args: { tone: "info", message: "Желание сохранено" },
  render: function InfoStory(args) {
    return (
      <PhoneFrame>
        <Toast {...args} onClose={noop} />
      </PhoneFrame>
    );
  },
};

/** An undo toast: the action «Отменить» and the close button share the 44 px zone. */
export const WithUndoAction: Story = {
  args: {
    tone: "info",
    message: "Желание удалено",
    action: { label: "Отменить", onPress: noop },
  },
  render: function WithUndoActionStory(args) {
    return (
      <PhoneFrame>
        <Toast {...args} onClose={noop} />
      </PhoneFrame>
    );
  },
  play: focusAction,
};

/** Focus and hover pause the countdown; the ring on the dark surface is `ring-inverse`. */
function focusAction({ canvasElement }: { canvasElement: HTMLElement }) {
  const action = canvasElement.querySelector<HTMLElement>("[aria-label='Отменить']");
  action?.focus();
}

/** A sticky bottom control lifts the toast above itself. */
export const AboveStickyButton: Story = {
  args: { tone: "info", message: "Ссылка скопирована", offsetBottom: 64 },
  render: function AboveStickyButtonStory(args) {
    return (
      <PhoneFrame>
        <Toast {...args} onClose={noop} />
      </PhoneFrame>
    );
  },
};

/** A long message at 360 px: the text shrinks and wraps, the buttons stay 44 × 44. */
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
        <Toast {...args} onClose={noop} />
      </PhoneFrame>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** The text alone, for the docs panel: what the host announces. */
export const MessageCopy: Story = {
  render: function MessageCopyStory(args) {
    return <Text kind="body">{args.message}</Text>;
  },
};
