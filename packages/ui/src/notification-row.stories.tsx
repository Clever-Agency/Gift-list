import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import type { ComponentType } from "react";
import { propDoc } from "../../../.storybook/argTypes";
import { Button } from "./button";
import { Bell } from "./icons";
import { NotificationRow, type NotificationRowProps } from "./notification-row";

/**
 * The row props plus the «есть действие» handle. The icon and the actions are
 * slots, so the catalog keeps a ready-made bell and one action button behind
 * controls instead of node knobs. The cast on `component` below is what lets the
 * Docs controls and the story args see the handle; the component stays unchanged.
 */
type NotificationRowCatalogProps = NotificationRowProps & { withActions: boolean };

const BELL = <Bell size={20} />;

/** The ready-made action of the «есть действие» handle: a reservation notice. */
const WAITING_ACTION = <Button variant="secondary" label="Подарил" busy />;

/**
 * One row of the notifications list: the unread dot, the section glyph, the
 * message, the subtitle, the time and the optional actions. The sandbox turns the
 * props and keeps the slots behind handles.
 */
const meta = {
  title: "UI/NotificationRow",
  component: NotificationRow as ComponentType<NotificationRowCatalogProps>,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
One row of the notifications list (\`EXPERIENCE.md\` → Notifications): the unread dot, the section glyph, a three-line message, an optional subtitle, the time and the optional actions. The unread row takes the \`body-strong\` weight, so the state is not colour alone.

What is not a prop:

- The glyph is a slot: the screen passes its own icon, and the row hides it from screen readers (\`aria-hidden\`) because the message already says what happened.
- The actions are a slot too — a row that waits for the person gets a button under the copy. The «есть действие» handle stands a ready-made one in.
- Without \`onPress\` the copy is a plain group with a composed accessible name; with it the copy becomes one button (\`role="button"\`) of at least 44 px.
- \`selected\` only paints the \`muted\` background of the row picked in a two-pane list.
        `.trim(),
      },
    },
  },
  argTypes: {
    message: propDoc({
      description: "The message of the row, at most three lines; the unread row reads it in `body-strong`.",
      type: "string",
      required: true,
      control: "text",
    }),
    time: propDoc({
      description: "When it happened, already formatted by the caller, e.g. «Сегодня, 10:24».",
      type: "string",
      required: true,
      control: "text",
    }),
    subtitle: propDoc({
      description: "A second line under the message, e.g. what happened next.",
      type: "string",
      control: "text",
    }),
    unread: propDoc({
      description:
        "An unread row: the `primary` dot and the `body-strong` message. The dot is decorative — the weight and the accessible name carry the state.",
      type: "boolean",
      required: true,
      defaultValue: "false",
    }),
    newLabel: propDoc({
      description:
        "The word for the unread state, e.g. «Новое»: it goes into the accessible name ahead of the message.",
      type: "string",
      required: true,
      control: "text",
    }),
    icon: propDoc({
      description:
        "The section glyph, drawn by the app and decorative (`aria-hidden`). The catalog shows a ready-made bell.",
      type: "ReactNode",
      required: true,
      control: false,
    }),
    actions: propDoc({
      description:
        "The actions under the copy, wrapping at a narrow width. A slot; the «есть действие» handle stands one ready-made button in.",
      type: "ReactNode",
      control: false,
    }),
    selected: propDoc({
      description: "The row picked in a two-pane list: the `muted` background, and nothing else changes.",
      type: "boolean",
      defaultValue: "false",
    }),
    onPress: propDoc({
      description:
        "Opens the notification. Not a control: with it the copy becomes one button, without it the copy is a plain group.",
      type: "() => void",
      control: false,
    }),
    withActions: {
      name: "есть действие",
      description:
        "Ручка каталога: показать в слоте `actions` готовую кнопку действия брони «Подарил».",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
  },
  args: {
    message: "Срок брони «Абонемент в ботанический сад» истёк. Если ничего не сделать, бронь снимется 3 декабря",
    time: "Сегодня, 10:24",
    newLabel: "Новое",
    unread: true,
    icon: BELL,
    selected: false,
    withActions: false,
  },
  globals: { viewport: { value: "w360" } },
} satisfies Meta<NotificationRowCatalogProps>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The row with the «есть действие» handle applied. */
function NotificationRowPreview({
  withActions,
  actions,
  icon,
  ...rowArgs
}: NotificationRowCatalogProps) {
  return (
    <YStack width={360} maxWidth="100%" backgroundColor="$surface">
      <NotificationRow
        {...rowArgs}
        icon={icon ?? BELL}
        actions={withActions ? (actions ?? WAITING_ACTION) : undefined}
      />
    </YStack>
  );
}

NotificationRowPreview.displayName = "NotificationRowPreview";

/**
 * The sandbox: write the message, the subtitle and the time, flip `unread` and
 * «есть действие». The glyph stays a ready-made bell, as the screen passes its own.
 */
export const Playground: Story = {
  render: function PlaygroundStory(args) {
    return <NotificationRowPreview {...args} />;
  },
};

/** A row that waits for the person: the action button sits under the copy. */
export const WaitingForAction: Story = {
  args: { withActions: true },
  render: function WaitingForActionStory(args) {
    return <NotificationRowPreview {...args} />;
  },
};

/** An unread row with a long Cyrillic message: three lines, then the ellipsis. */
export const UnreadLongCyrillic: Story = {
  tags: ["!dev"],
  render: function UnreadLongCyrillicStory(args) {
    return <NotificationRowPreview {...args} />;
  },
};

/** A read row with a subtitle and a later time. */
export const ReadStale: Story = {
  tags: ["!dev"],
  args: { unread: false, subtitle: "Даритель уже ответил", time: "Вчера, 18:02" },
  render: function ReadStaleStory(args) {
    return <NotificationRowPreview {...args} />;
  },
};

/** The picked row of a two-pane list: the `muted` background. */
export const Selected: Story = {
  tags: ["!dev"],
  args: { selected: true },
  render: function SelectedStory(args) {
    return <NotificationRowPreview {...args} />;
  },
};
