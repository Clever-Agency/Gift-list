import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import { useEffect, useState, type ComponentType } from "react";
import { propDoc } from "../../../.storybook/argTypes";
import { PasswordField, type PasswordFieldProps } from "./text-field";

/** The catalog copy is a fixture, not a product string (`packages/ui` has no translations). */
function noop() {}

/** The ready-made message the «есть ошибка» handle stands in. */
const PASSWORD_ERROR = "Пароль должен быть не короче 12 символов";

/**
 * The password props plus the catalog handles. A disabled input and an error are
 * set through `input.disabled` and a fixture string, so the panel turns switches
 * instead of node knobs. The cast on `component` below is what lets the Docs
 * controls and the story args see the handles; the component itself stays unchanged.
 */
type PasswordFieldCatalogProps = PasswordFieldProps & {
  disabled: boolean;
  hasError: boolean;
};

/**
 * The password field of the sign-in and registration forms (`DESIGN.md` →
 * «Поля входа»): a `TextField` that hides its text, with an icon-only toggle
 * inside the field. The sandbox is a live field — the eye really reveals the text.
 */
const meta = {
  title: "UI/PasswordField",
  component: PasswordField as ComponentType<PasswordFieldCatalogProps>,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
A \`TextField\` that hides its text, with an icon-only reveal button inside the field on the right (\`DESIGN.md\` → «Поля входа»). The field is controlled like \`TextField\`: \`value\` and \`onChangeText\` belong to the caller.

What is not a prop:

- The eye button takes only an icon: its name is \`showLabel\` and it keeps that name in both states, while the state itself is \`aria-pressed\` on the web and \`accessibilityState.checked\` on the phone. A hidden password shows \`Eye\`, a revealed one \`EyeOff\`.
- The button types nothing, so it keeps the focus (and the caret) in the field; it sits in the field's right inset, so the text never runs under it.
- \`disabled\`, \`testID\`, \`autoComplete\` and the rest of the input go through the \`input\` bag. The «выключено» handle stands the first one in.
- The error is one string: rendered once under the field, announced as an alert and linked with \`aria-describedby\` and \`aria-invalid\`. The «есть ошибка» handle stands a ready-made message in.
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
        "The current password. The sandbox keeps it locally, so typing sticks and the `value` control re-seeds it.",
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
    showLabel: propDoc({
      description:
        "The accessible name of the eye button, e.g. «Показать пароль». It stays the same in both states; the state is announced separately.",
      type: "string",
      required: true,
      control: "text",
    }),
    error: propDoc({
      description:
        "A validation error from the screen: shown in `destructive`, announced with `role=\"alert\"` and linked to the input. An error replaces the hint. The «есть ошибка» handle stands a ready-made message in.",
      type: "string",
      control: false,
    }),
    hint: propDoc({
      description:
        "A permanent line under the field in `muted-foreground`, e.g. the length rule. An error replaces it.",
      type: "string",
      control: "text",
    }),
    input: propDoc({
      description:
        "The rest of the input: `disabled`, `testID`, `autoComplete`, `maxLength`, `onSubmitEditing`… The field owns the value, the id and the ARIA links.",
      type: "TextFieldInputProps",
      control: false,
    }),
    disabled: {
      name: "выключено",
      description:
        "Ручка каталога: выключить поле через `input.disabled` — пароль виден, но менять его нельзя.",
      control: "boolean",
      table: {
        category: "Ручки каталога",
        type: { summary: "boolean" },
        defaultValue: { summary: "false" },
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
    label: "Пароль",
    value: "wishmoon-demo",
    onChangeText: noop,
    showLabel: "Показать пароль",
    hint: "Не короче 12 символов",
    disabled: false,
    hasError: false,
  },
} satisfies Meta<PasswordFieldCatalogProps>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The field with the catalog handles applied: the error and the input bag. */
function PasswordFieldPreview({
  disabled,
  hasError,
  input,
  hint,
  ...fieldArgs
}: PasswordFieldCatalogProps) {
  return (
    <YStack width={360} maxWidth="100%">
      <PasswordField
        {...fieldArgs}
        hint={hint}
        error={hasError ? PASSWORD_ERROR : undefined}
        input={{ ...input, disabled: disabled || undefined }}
      />
    </YStack>
  );
}

PasswordFieldPreview.displayName = "PasswordFieldPreview";

/**
 * The sandbox: type into the field and press the eye — the text really hides and
 * shows. `label`, `hint` and `showLabel` are in the panel; «выключено» и «есть
 * ошибка» play the input bag and a ready-made error in.
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

    return <PasswordFieldPreview {...args} value={value} onChangeText={setValue} />;
  },
};

/**
 * The revealed state is the field's own toggle: the story presses the real eye
 * button, so nothing is faked with styles. Press it once more to hide the text.
 */
export const Revealed: Story = {
  render: function RevealedStory(args) {
    return <PasswordFieldPreview {...args} />;
  },
  play: function revealPassword({ canvasElement }) {
    canvasElement.querySelector<HTMLElement>("[aria-label='Показать пароль']")?.click();
  },
};

/** The usual state of the field: the dots instead of the text, the hint under it. */
export const Hidden: Story = {
  tags: ["!dev"],
  render: function HiddenStory(args) {
    return <PasswordFieldPreview {...args} />;
  },
};

/** A field the form does not let change: the password keeps its dots, the eye still works. */
export const Disabled: Story = {
  tags: ["!dev"],
  args: { disabled: true },
  render: function DisabledStory(args) {
    return <PasswordFieldPreview {...args} />;
  },
};

/** An error replaces the hint, turns the frame red and is read as an alert. */
export const WithError: Story = {
  tags: ["!dev"],
  args: { hint: undefined, hasError: true },
  render: function WithErrorStory(args) {
    return <PasswordFieldPreview {...args} />;
  },
};
