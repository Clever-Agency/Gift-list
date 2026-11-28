import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import type { ComponentType, ReactNode } from "react";
import { formatUnionType, propDoc } from "../../../.storybook/argTypes";
import { View } from "./layout";
import { Text } from "./text";
import { Toast, type ToastProps, type ToastTone } from "./toast";

const TOAST_TONES = ["info", "success", "warning", "error"] as const satisfies readonly ToastTone[];

/** The catalog copy is a fixture, not a product string (`packages/ui` has no translations). */
function noop() {}

/** The ready-made action of the «есть действие» handle: the undo of a closed wish. */
const UNDO_ACTION = { label: "Отменить", onPress: noop };

/**
 * The toast props plus the «есть действие» handle. The action is an object slot, so
 * the catalog keeps one ready-made «Отменить» behind a switch instead of knobs for
 * a callback and a label. The cast on `component` below is what lets the Docs
 * controls and the story args see the handle; the component stays unchanged.
 */
type ToastCatalogProps = ToastProps & { withAction: boolean };

/**
 * `Toast` is the look of a toast; the host decides when to show and hide it. It is
 * absolutely positioned like the app draws it, so every frame in the catalog is a
 * relative box of the phone size — no toast can cover the docs page around it.
 */
const meta = {
  title: "UI/Toast",
  component: Toast as ComponentType<ToastCatalogProps>,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The look of a toast (\`DESIGN.md\` → components \`toast\`, \`toast-error\`): a \`surface\` card with radius 16, a 1 px frame and the card elevation. \`Toast\` only draws it — the host decides when to show and hide it and owns the countdown.

What is not a prop:

- The tone is carried by a small icon and its calm ink (\`info\` primary, \`success\` green, \`warning\` muted terracotta — never yellow, \`error\` coral), while the text stays neutral, so every pair keeps AA contrast.
- \`error\` and \`warning\` are announced assertively (\`role="alert"\`), \`info\` and \`success\` politely (\`role="status"\`). On a phone the same tones become an Android live region, and iOS speaks the new text once with \`AccessibilityInfo.announceForAccessibility\` (\`toast-a11y.ts\` / \`toast-a11y.native.ts\`). The overlay lets touches through; only the toast takes them.
- The action is an object slot \`{ label, onPress }\`: a text button under the message, so a long label wraps with the text. \`actionRef\` hands that button to the screen, which moves focus onto it right after closing a wish (\`DESIGN.md\` → «Куда уходит фокус», пункт «а»). The «есть действие» handle stands «Отменить» in.
- \`onHoverChange\` and \`onFocusChange\` only feed the host's countdown pause: neither changes the look.
- The card is always absolutely positioned at the bottom of the screen, above \`offsetBottom\` (a sticky control); the catalog puts it in a phone-sized relative frame. It fades in and out with \`quick\` (160 ms); with «уменьшить движение» the fade is 100 ms and there is no shift.
        `.trim(),
      },
    },
  },
  argTypes: {
    message: propDoc({
      description:
        "The line of the toast; with `title` it becomes the description under it. The text comes from the app's catalogue.",
      type: "string",
      required: true,
      control: "text",
    }),
    title: propDoc({
      description: "An optional title: the toast then becomes a two-line card.",
      type: "string",
      control: "text",
    }),
    tone: propDoc({
      description:
        "`info` (primary ink, polite), `success` (green check, polite), `warning` (muted terracotta triangle, assertive), `error` (coral, assertive).",
      type: formatUnionType(TOAST_TONES),
      options: TOAST_TONES,
      defaultValue: "error",
    }),
    closeLabel: propDoc({
      description: "The accessible name of the close cross, e.g. «Закрыть».",
      type: "string",
      required: true,
      control: "text",
    }),
    onClose: propDoc({
      description: "A press on the cross; the host takes the toast away.",
      type: "() => void",
      required: true,
      control: false,
    }),
    action: propDoc({
      description:
        "The action of the toast (undo, retry): a text button under the message, so a long label wraps with the text. The «есть действие» handle stands «Отменить» in.",
      type: "{ label: string; onPress: () => void }",
      control: false,
    }),
    actionRef: propDoc({
      description:
        "The action button itself, so the screen can move focus onto it after the action that raised the toast. `null` when there is no `action`.",
      type: "RefObject<FocusTarget | null>",
      control: false,
    }),
    loading: propDoc({
      description:
        "The action is running: a spinner replaces the tone icon and the card is announced busy.",
      type: "boolean",
      defaultValue: "false",
    }),
    dismissible: propDoc({
      description: "Show the close cross. Defaults to `true`; a blocking toast can hide it.",
      type: "boolean",
      defaultValue: "true",
    }),
    offsetBottom: propDoc({
      description:
        "Height of a sticky bottom control the toast must not cover: the host lifts the toast above it.",
      type: "number",
      defaultValue: "0",
    }),
    onHoverChange: propDoc({
      description:
        "The pointer entered or left the toast, so the host can pause the countdown. Changes no look.",
      type: "(hovered: boolean) => void",
      control: false,
    }),
    onFocusChange: propDoc({
      description:
        "Focus entered or left one of the controls, for pausing the countdown; the control says which one, so the host can tell the screen's own focus move from Tab or a click.",
      type: "(focused: boolean, control: \"action\" | \"close\") => void",
      control: false,
    }),
    visible: propDoc({
      description:
        "Whether the toast is shown. The host is taking it away: it fades out, stops taking touches and unmounts it when the fade is over.",
      type: "boolean",
      defaultValue: "true",
    }),
    testID: propDoc({
      description: "A stable handle for tests; reaches the web DOM as `data-testid`.",
      type: "string",
      control: "text",
    }),
    withAction: {
      name: "есть действие",
      description:
        "Ручка каталога: показать слот `action` с готовым «Отменить» — текстовая кнопка под сообщением.",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
    },
  },
  args: {
    message: "Желание удалено",
    tone: "info",
    closeLabel: "Закрыть",
    onClose: noop,
    loading: false,
    dismissible: true,
    offsetBottom: 0,
    visible: true,
    testID: "toast",
    withAction: true,
  },
} satisfies Meta<ToastCatalogProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A phone-sized box the absolutely positioned toast sits in. */
function ToastFrame({ children, height = 200 }: { children: ReactNode; height?: number }) {
  return (
    <View
      position="relative"
      width={360}
      maxWidth="100%"
      height={height}
      backgroundColor="$background"
      overflow="hidden"
    >
      {children}
    </View>
  );
}

ToastFrame.displayName = "ToastFrame";

/** The toast with the «есть действие» handle applied. */
function ToastPreview({ withAction, action, ...toastArgs }: ToastCatalogProps) {
  return (
    <ToastFrame>
      <Toast {...toastArgs} action={withAction ? (action ?? UNDO_ACTION) : undefined} />
    </ToastFrame>
  );
}

ToastPreview.displayName = "ToastPreview";

/**
 * The sandbox: write `message` and `title`, pick a `tone`, flip «есть действие»,
 * `dismissible` and `visible`. Flip `visible` off to see how the host takes the
 * toast away — the card fades and leaves the frame empty.
 */
export const Playground: Story = {
  render: function PlaygroundStory(args) {
    return <ToastPreview {...args} />;
  },
};

/**
 * An undo toast: the action «Отменить» is a text button under the message. Focus
 * is on the action, as the screen puts it right after closing a wish.
 */
export const WithUndoAction: Story = {
  args: {
    tone: "info",
    message: "Желание удалено",
    withAction: true,
  },
  render: function WithUndoActionStory(args) {
    return <ToastPreview {...args} />;
  },
  play: focusAction,
};

/** `error` (the component default): the coral icon and an assertive announcement. */
export const Error: Story = {
  tags: ["!dev"],
  args: {
    tone: "error",
    message: "Не удалось сохранить желание. Попробуйте ещё раз.",
    withAction: false,
  },
  render: function ErrorStory(args) {
    return <ToastPreview {...args} />;
  },
};

/** `info`: the primary icon and a polite announcement, e.g. «Желание сохранено». */
export const Info: Story = {
  tags: ["!dev"],
  args: { tone: "info", message: "Желание сохранено", withAction: false },
  render: function InfoStory(args) {
    return <ToastPreview {...args} />;
  },
};

/** `success`: the green check, polite — the action went through. */
export const Success: Story = {
  tags: ["!dev"],
  args: { tone: "success", message: "Куплено — отметка сохранена", withAction: false },
  render: function SuccessStory(args) {
    return <ToastPreview {...args} />;
  },
};

/** `warning`: a muted terracotta triangle, assertive — no yellow anywhere in v8. */
export const Warning: Story = {
  tags: ["!dev"],
  args: { tone: "warning", message: "Список скоро станет приватным", withAction: false },
  render: function WarningStory(args) {
    return <ToastPreview {...args} />;
  },
};

/** Title + description: the two-line card of the reference. */
export const WithTitle: Story = {
  tags: ["!dev"],
  args: {
    tone: "success",
    title: "Желание забронировано",
    message: "Владелец списка не узнает, кто его выбрал.",
  },
  render: function WithTitleStory(args) {
    return <ToastPreview {...args} />;
  },
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
  tags: ["!dev"],
  args: {
    tone: "success",
    message: "Отмечено полученным",
  },
  render: function ClosedUndoStory(args) {
    return <ToastPreview {...args} />;
  },
  play: focusAction,
  globals: { viewport: { value: "w360" } },
};

/** The action is running: a spinner instead of the icon, the card is announced busy. */
export const LoadingAction: Story = {
  tags: ["!dev"],
  args: {
    tone: "info",
    message: "Сохраняем изменения",
    withAction: false,
    loading: true,
  },
  render: function LoadingActionStory(args) {
    return <ToastPreview {...args} />;
  },
};

/** Without a close cross: a blocking toast that the host dismisses itself. */
export const WithoutClose: Story = {
  tags: ["!dev"],
  args: {
    tone: "warning",
    message: "Отправляем приглашение…",
    loading: true,
    dismissible: false,
    withAction: false,
  },
  render: function WithoutCloseStory(args) {
    return <ToastPreview {...args} />;
  },
};

/** A sticky bottom control lifts the toast above itself. */
export const AboveStickyButton: Story = {
  tags: ["!dev"],
  args: { tone: "info", message: "Ссылка скопирована", offsetBottom: 64, withAction: false },
  render: function AboveStickyButtonStory(args) {
    return <ToastPreview {...args} />;
  },
};

/** A long message at 360 px: the text shrinks and wraps, the controls stay 44 × 44. */
export const LongMessageNarrow: Story = {
  tags: ["!dev"],
  args: {
    tone: "error",
    message:
      "Не удалось забронировать желание: его только что забронировал другой человек. Обновите список.",
    action: { label: "Повторить", onPress: noop },
    withAction: true,
  },
  render: function LongMessageNarrowStory(args) {
    return <ToastPreview {...args} />;
  },
  globals: { viewport: { value: "w360" } },
};

const GALLERY_COPY: Record<ToastTone, { title: string; text: string }> = {
  info: { title: "Ссылка скопирована", text: "Отправьте её друзьям в любом мессенджере." },
  success: { title: "Желание забронировано", text: "Владелец списка не узнает, кто его выбрал." },
  warning: { title: "Список скоро станет приватным", text: "До дня рождения осталось 3 дня." },
  error: { title: "Не удалось сохранить", text: "Проверьте соединение и попробуйте ещё раз." },
};

/** The whole set: every tone in the three shapes the app may ask for. */
export const AllToasts: Story = {
  tags: ["!dev"],
  render: function AllToastsStory() {
    return (
      <YStack gap="$3" padding="$3" backgroundColor="$background" width={1180} maxWidth="100%">
        {TOAST_TONES.map(function toneRow(tone) {
          const copy = GALLERY_COPY[tone];
          return (
            <YStack key={tone} gap="$1">
              <Text kind="caption" tone="muted">
                {tone}
              </Text>
              <YStack flexDirection="row" gap="$2" flexWrap="wrap">
                <ToastFrame height={110}>
                  <Toast tone={tone} message={copy.text} closeLabel="Закрыть" onClose={noop} />
                </ToastFrame>
                <ToastFrame height={150}>
                  <Toast
                    tone={tone}
                    title={copy.title}
                    message={copy.text}
                    action={{ label: "Отменить", onPress: noop }}
                    closeLabel="Закрыть"
                    onClose={noop}
                  />
                </ToastFrame>
                <ToastFrame height={130}>
                  <Toast
                    tone={tone}
                    title={copy.title}
                    message="Сохраняем изменения"
                    loading
                    closeLabel="Закрыть"
                    onClose={noop}
                  />
                </ToastFrame>
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
  tags: ["!dev"],
  render: function MessageCopyStory(args) {
    return <Text kind="body">{args.message}</Text>;
  },
};
