import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import { useEffect, useState, type ComponentType } from "react";
import { propDoc } from "../../../.storybook/argTypes";
import { TextField, type TextFieldProps } from "./text-field";

/** The catalog copy is a fixture, not a product string (`packages/ui` has no translations). */
function noop() {}

/** The ready-made message the «есть ошибка» handle stands in. */
const FIELD_ERROR = "Название не может быть пустым";

/**
 * The field props plus the catalog handles. `TextField` owns none of them: a
 * disabled or `testID`-marked input is set through the `input` bag, and the error
 * message is a fixture, so the panel turns switches instead of node knobs. The
 * cast on `component` below is what lets the Docs controls and the story args see
 * the handles; the component itself stays unchanged.
 */
type TextFieldCatalogProps = TextFieldProps & {
  disabled: boolean;
  testID: string;
  hasError: boolean;
};

/**
 * A labelled text input: the value is live, so typing in the sandbox sticks, while
 * the `value` control re-seeds it. `disabled` and `testID` are not props of the
 * field — they go into `input`, where the rest of the input's props live.
 */
const meta = {
  title: "UI/TextField",
  component: TextField as ComponentType<TextFieldCatalogProps>,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The labelled text input of the forms (\`DESIGN.md\` → components \`input\`): \`surface\` fill, a \`border-strong\` frame that turns \`ring\` on focus and \`destructive\` on error, and 48 px of height. The package is controlled: \`value\` and \`onChangeText\` belong to the caller.

What is not a prop:

- \`disabled\`, \`testID\`, \`maxLength\`, \`keyboardType\` and the rest of the input go through the \`input\` bag — the field owns only the value, the label and the described-by line. The «выключено» and «testID» handles stand them in.
- The error is one string: the field renders it once under the input with \`role="alert"\`, links it with \`aria-describedby\` and \`aria-invalid\`, and on a phone passes the same text as the accessibility hint. The «есть ошибка» handle stands a ready-made message in; an error replaces the hint.
- Hover and focus are CSS states, not props: hover the field or press Tab. A text input is always \`:focus-visible\` while it holds the caret.
- \`multiline\` swaps the input for a \`<textarea>\`, \`rows\` lines tall.
        `.trim(),
      },
    },
  },
  argTypes: {
    label: propDoc({
      description: "The visible label and the accessible name of the input.",
      type: "string",
      required: true,
      control: "text",
    }),
    value: propDoc({
      description:
        "The current text. The package is controlled: the sandbox keeps the value locally, so typing sticks and the control re-seeds it.",
      type: "string",
      required: true,
      control: "text",
    }),
    onChangeText: propDoc({
      description: "The new text on every keystroke; the caller owns the value and its validation.",
      type: "(value: string) => void",
      required: true,
      control: false,
    }),
    error: propDoc({
      description:
        "A validation error from the screen: shown in `destructive` under the field, announced with `role=\"alert\"` and linked to the input. The «есть ошибка» handle stands a ready-made message in.",
      type: "string",
      control: false,
    }),
    hint: propDoc({
      description:
        "A permanent line under the field in `muted-foreground`, e.g. the length limit. An error replaces it.",
      type: "string",
      control: "text",
    }),
    multiline: propDoc({
      description:
        "Renders a `<textarea>` on the web and a multi-line input on a phone; the description then starts at the top.",
      type: "boolean",
      defaultValue: "false",
    }),
    rows: propDoc({
      description: "How many lines a `multiline` field is tall. Defaults to 3.",
      type: "number",
      defaultValue: "3",
    }),
    input: propDoc({
      description:
        "The rest of the input: `disabled`, `testID`, `maxLength`, `keyboardType`, `autoComplete`, `onSubmitEditing`… The field owns the value, the id and the ARIA links, so those are not taken from here.",
      type: "TextFieldInputProps",
      control: false,
    }),
    disabled: {
      name: "выключено",
      description:
        "Ручка каталога: выключить поле через `input.disabled` — хранимое значение видно, но менять его нельзя.",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
    testID: {
      name: "testID",
      description:
        "Ручка каталога: передать `input.testID`, который на вебе становится `data-testid`.",
      control: "text",
      table: {
        category: "Ручки каталога",
        type: { summary: "string" },
      },
    },
    hasError: {
      name: "есть ошибка",
      description:
        "Ручка каталога: показать готовое сообщение об ошибке вместо подсказки и покрасить рамку в `destructive`.",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
      },
    },
  },
  args: {
    label: "Название желания",
    value: "Плед из шерсти мериноса",
    onChangeText: noop,
    hint: "До 60 символов, без эмодзи",
    multiline: false,
    rows: 3,
    disabled: false,
    testID: "",
    hasError: false,
  },
} satisfies Meta<TextFieldCatalogProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The field with the catalog handles applied: the error and the input bag. */
function TextFieldPreview({
  disabled,
  testID,
  hasError,
  input,
  hint,
  ...fieldArgs
}: TextFieldCatalogProps) {
  return (
    <YStack width={360} maxWidth="100%">
      <TextField
        {...fieldArgs}
        hint={hint}
        error={hasError ? FIELD_ERROR : undefined}
        input={{
          ...input,
          disabled: disabled || undefined,
          testID: testID || undefined,
        }}
      />
    </YStack>
  );
}

TextFieldPreview.displayName = "TextFieldPreview";

/**
 * The sandbox: type into the field — the text really stays — and turn `label`,
 * `hint`, `multiline` and `rows` in the panel. «Выключено», «testID» and «есть
 * ошибка» play the input bag and a ready-made error in, so no node knobs appear.
 */
export const Playground: Story = {
  render: function PlaygroundStory(args) {
    const [value, setValue] = useState(args.value);

    useEffect(
      function syncValueFromControls() {
        setValue(args.value);
      },
      [args.value],
    );

    return <TextFieldPreview {...args} value={value} onChangeText={setValue} />;
  },
};

/** The error replaces the hint, turns the frame red and is read as an alert. */
export const WithError: Story = {
  args: { value: "", hint: undefined, hasError: true },
  render: function WithErrorStory(args) {
    return <TextFieldPreview {...args} />;
  },
};

/** No text yet: the placeholder is the caller's, the label stays above the field. */
export const Empty: Story = {
  tags: ["!dev"],
  args: { value: "", hint: undefined },
  render: function EmptyStory(args) {
    return <TextFieldPreview {...args} />;
  },
};

/** The usual filled field: the value alone, no hint line. */
export const WithText: Story = {
  tags: ["!dev"],
  args: { hint: undefined },
  render: function WithTextStory(args) {
    return <TextFieldPreview {...args} />;
  },
};

/** The hint alone, e.g. the length limit. */
export const WithHint: Story = {
  tags: ["!dev"],
  args: { value: "Плед из шерсти мериноса" },
  render: function WithHintStory(args) {
    return <TextFieldPreview {...args} />;
  },
};

/** A stored value the form does not let change: the field keeps its text. */
export const Disabled: Story = {
  tags: ["!dev"],
  args: { disabled: true, hint: undefined },
  render: function DisabledStory(args) {
    return <TextFieldPreview {...args} />;
  },
};

/**
 * The focus state is the real CSS one: the story puts the caret into the field, and
 * the browser paints the `ring` border plus the 2 px ring with a 2 px offset. Click
 * the field too — a text input is always `:focus-visible` while it holds the caret.
 */
export const Focused: Story = {
  tags: ["!dev"],
  args: { hint: undefined },
  render: function FocusedStory(args) {
    return <TextFieldPreview {...args} />;
  },
  play: function focusInput({ canvasElement }) {
    canvasElement.querySelector<HTMLElement>("input, textarea")?.focus();
  },
};

/** A multi-line field: the description starts at the top and the box is `rows` lines tall. */
export const Multiline: Story = {
  tags: ["!dev"],
  args: {
    label: "Описание",
    value: "Мягкий, тёплый, подходит для чтения в кресле.",
    multiline: true,
    rows: 4,
    hint: "До 500 символов",
  },
  render: function MultilineStory(args) {
    return <TextFieldPreview {...args} />;
  },
};
