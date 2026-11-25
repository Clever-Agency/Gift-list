import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import type { ComponentType } from "react";
import { propDoc } from "../../../.storybook/argTypes";
import { Button } from "./button";
import { EmptyState, type EmptyStateProps } from "./empty-state";

/**
 * The empty-state props plus the «есть действие» handle. The action is a slot, so
 * the catalog keeps one ready-made primary CTA behind a switch instead of a node
 * knob. The cast on `component` below is what lets the Docs controls and the
 * story args see the handle; the component itself stays unchanged.
 */
type EmptyStateCatalogProps = EmptyStateProps & { withAction: boolean };

/** The one primary CTA of the catalog empty state. */
const EMPTY_ACTION = <Button label="Добавить желание" variant="primary" />;

/**
 * `EmptyState` is the empty list: a display title, one body line and at most one
 * primary CTA. The copy comes from `EXPERIENCE.md` → Empty states, via the app.
 */
const meta = {
  title: "UI/EmptyState",
  component: EmptyState as ComponentType<EmptyStateCatalogProps>,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The empty list of the app (\`DESIGN.md\` → EmptyState, \`EXPERIENCE.md\` → Empty states): a centred display title, one body line and at most one primary CTA.

What is not a prop:

- The action is a slot, not a component choice: the screen passes its own button (or nothing). The «есть действие» handle stands a ready-made primary CTA in.
- The block is centred and capped at \`max-form\` width; the page gutter belongs to the screen around it.
- The copy comes from the app's catalogue — «Здесь пока пусто» and the hint are fixtures here, not product strings.
        `.trim(),
      },
    },
  },
  argTypes: {
    title: propDoc({
      description: "The display title of the empty list, centred; it is also the heading level 2.",
      type: "string",
      required: true,
      control: "text",
    }),
    body: propDoc({
      description:
        "One line under the title. A public link page with no wishes has none, so the line is optional.",
      type: "string",
      control: "text",
    }),
    action: propDoc({
      description:
        "The one primary CTA, or nothing. A slot: the screen passes its own button. The «есть действие» handle stands a ready-made one in.",
      type: "ReactNode",
      control: false,
    }),
    withAction: {
      name: "есть действие",
      description:
        "Ручка каталога: показать готовую основную кнопку в слоте `action`.",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "true" },
      },
    },
  },
  args: {
    title: "Здесь пока пусто",
    body: "Добавьте первое желание — его увидят друзья.",
    withAction: true,
  },
} satisfies Meta<EmptyStateCatalogProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The empty state with the «есть действие» handle applied. */
function EmptyStatePreview({ withAction, action, ...emptyArgs }: EmptyStateCatalogProps) {
  return (
    <YStack width={360} maxWidth="100%">
      <EmptyState {...emptyArgs} action={withAction ? (action ?? EMPTY_ACTION) : undefined} />
    </YStack>
  );
}

EmptyStatePreview.displayName = "EmptyStatePreview";

/**
 * The sandbox: write the title and the body, flip «есть действие» to add or drop
 * the CTA. The block stays centred at the form width.
 */
export const Playground: Story = {
  render: function PlaygroundStory(args) {
    return <EmptyStatePreview {...args} />;
  },
};

/** Without a CTA, e.g. a public link page with no wishes. */
export const WithoutAction: Story = {
  args: {
    title: "В этом вишлисте пока нет желаний",
    body: undefined,
    withAction: false,
  },
  render: function WithoutActionStory(args) {
    return <EmptyStatePreview {...args} />;
  },
};

/** With one CTA, the usual case. */
export const WithAction: Story = {
  tags: ["!dev"],
  render: function WithActionStory(args) {
    return <EmptyStatePreview {...args} />;
  },
};

/** A long title at 360 px: the display title wraps and stays centred. */
export const LongTitleNarrow: Story = {
  tags: ["!dev"],
  args: {
    title: "Вы ещё не добавили ни одного желания",
    body: "Самое время начать: нажмите «Добавить желание» и расскажите о том, что хочется получить.",
  },
  render: function LongTitleNarrowStory(args) {
    return <EmptyStatePreview {...args} />;
  },
  globals: { viewport: { value: "w360" } },
};
