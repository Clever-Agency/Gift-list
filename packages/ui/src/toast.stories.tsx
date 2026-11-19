import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import { Text } from "./text";
import { Toast, type ToastTone } from "./toast";
import { View } from "./layout";

/**
 * `Toast` is the look of a toast; the host decides when to show and hide it. The card
 * is `surface` with radius 16, a 1 px frame and the card elevation; the tone is a
 * small icon with its calm ink (`info` primary, `success` green, `warning` muted
 * terracotta — never yellow, `error` coral), the text stays neutral. `error` and
 * `warning` are announced assertively, `info` and `success` politely; the overlay lets
 * touches through. It fades in and out with `quick` (160 ms, `DESIGN.md` → Движение);
 * with «уменьшить движение» the fade is 100 ms and there is no shift.
 *
 * The stories put the absolutely positioned toast in a phone frame so it sits where
 * the app draws it; switch the toolbar theme to check both palettes.
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
function PhoneFrame({ children, height = 200 }: { children: React.ReactNode; height?: number }) {
  return (
    <View position="relative" width={360} height={height} backgroundColor="$background" overflow="hidden">
      {children}
    </View>
  );
}

PhoneFrame.displayName = "PhoneFrame";

/** `error` (the default): the coral icon and an assertive announcement. */
export const Error: Story = {
  render: function ErrorStory(args) {
    return (
      <PhoneFrame>
        <Toast {...args} onClose={noop} />
      </PhoneFrame>
    );
  },
};

/** `info`: the primary icon and a polite announcement, e.g. «Желание сохранено». */
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

/** `success`: the green check, polite — the action went through. */
export const Success: Story = {
  args: { tone: "success", message: "Куплено — владелец увидит отметку" },
  render: function SuccessStory(args) {
    return (
      <PhoneFrame>
        <Toast {...args} onClose={noop} />
      </PhoneFrame>
    );
  },
};

/** `warning`: a muted terracotta triangle, assertive — no yellow anywhere in v8. */
export const Warning: Story = {
  args: { tone: "warning", message: "Список скоро станет приватным" },
  render: function WarningStory(args) {
    return (
      <PhoneFrame>
        <Toast {...args} onClose={noop} />
      </PhoneFrame>
    );
  },
};

/** Title + description: the two-line card of the reference. */
export const WithTitle: Story = {
  args: {
    tone: "success",
    title: "Желание забронировано",
    message: "Владелец списка не узнает, кто его выбрал.",
    action: { label: "Отменить", onPress: noop },
  },
  render: function WithTitleStory(args) {
    return (
      <PhoneFrame height={220}>
        <Toast {...args} onClose={noop} />
      </PhoneFrame>
    );
  },
};

/** An undo toast: the action «Отменить» is a text button under the message. */
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

/** Focus and hover pause the countdown; the ring on the card is the regular `$ring`. */
function focusAction({ canvasElement }: { canvasElement: HTMLElement }) {
  const action = canvasElement.querySelector<HTMLElement>("[aria-label='Отменить']");
  action?.focus();
}

/**
 * The undo toast of a closed wish (Story 5.3): «Отмечено полученным · Отменить».
 * `Toast` only draws it — the 10 s countdown lives in `ToastHost`, which pauses it on
 * hover and on the focus a person sets (`onFocusChange` names the control, so a host
 * can tell the screen's own focus move from a Tab or a click). `actionRef` gives the
 * screen the action button, so focus can land on «Отменить» right after closing
 * (`DESIGN.md` → «Куда уходит фокус», пункт «а»).
 */
export const ClosedUndo: Story = {
  args: {
    tone: "success",
    message: "Отмечено полученным",
    action: { label: "Отменить", onPress: noop },
  },
  render: function ClosedUndoStory(args) {
    return (
      <PhoneFrame>
        <Toast {...args} onClose={noop} />
      </PhoneFrame>
    );
  },
  play: focusAction,
  globals: { viewport: { value: "w360" } },
};

/** The action is running: a spinner instead of the icon, the card is announced busy. */
export const LoadingAction: Story = {
  args: { tone: "info", message: "Сохраняем изменения", loading: true },
  render: function LoadingActionStory(args) {
    return (
      <PhoneFrame>
        <Toast {...args} onClose={noop} />
      </PhoneFrame>
    );
  },
};

/** Without a close cross: a blocking toast that the host dismisses itself. */
export const WithoutClose: Story = {
  args: { tone: "warning", message: "Отправляем приглашение…", loading: true, dismissible: false },
  render: function WithoutCloseStory(args) {
    return (
      <PhoneFrame>
        <Toast {...args} onClose={noop} />
      </PhoneFrame>
    );
  },
};

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

/** A long message at 360 px: the text shrinks and wraps, the controls stay 44 × 44. */
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

const GALLERY_TONES: ToastTone[] = ["info", "success", "warning", "error"];

const GALLERY_COPY: Record<ToastTone, { title: string; text: string }> = {
  info: { title: "Ссылка скопирована", text: "Отправьте её друзьям в любом мессенджере." },
  success: { title: "Желание забронировано", text: "Владелец списка не узнает, кто его выбрал." },
  warning: { title: "Список скоро станет приватным", text: "До дня рождения осталось 3 дня." },
  error: { title: "Не удалось сохранить", text: "Проверьте соединение и попробуйте ещё раз." },
};

/** The whole set: every tone in the three shapes the app may ask for. */
export const AllToasts: Story = {
  render: function AllToastsStory() {
    return (
      <YStack gap="$3" padding="$3" backgroundColor="$background" width={1180}>
        {GALLERY_TONES.map(function toneRow(tone) {
          const copy = GALLERY_COPY[tone];
          return (
            <YStack key={tone} gap="$1">
              <Text kind="caption" tone="muted">
                {tone}
              </Text>
              <YStack flexDirection="row" gap="$2" flexWrap="wrap">
                <View position="relative" width={360} height={110} backgroundColor="$background">
                  <Toast tone={tone} message={copy.text} closeLabel="Закрыть" onClose={noop} />
                </View>
                <View position="relative" width={360} height={150} backgroundColor="$background">
                  <Toast
                    tone={tone}
                    title={copy.title}
                    message={copy.text}
                    action={{ label: "Отменить", onPress: noop }}
                    closeLabel="Закрыть"
                    onClose={noop}
                  />
                </View>
                <View position="relative" width={360} height={130} backgroundColor="$background">
                  <Toast
                    tone={tone}
                    title={copy.title}
                    message="Сохраняем изменения"
                    loading
                    closeLabel="Закрыть"
                    onClose={noop}
                  />
                </View>
              </YStack>
            </YStack>
          );
        })}
      </YStack>
    );
  },
  parameters: { layout: "fullscreen" },
};

/** The text alone, for the docs panel: what the host announces. */
export const MessageCopy: Story = {
  render: function MessageCopyStory(args) {
    return <Text kind="body">{args.message}</Text>;
  },
};
