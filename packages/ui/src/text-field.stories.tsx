import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { PasswordField, TextField, type TextFieldProps } from "./text-field";

/** The catalog copy is a fixture, not a product string (`packages/ui` has no translations). */
function noop() {}

/**
 * A field that keeps what you type: the package stays controlled, the state lives in
 * the story. `args` seed the first render, the controls panel changes the states
 * (empty, text, hint, error, multiline).
 */
function FieldStory({ value: initialValue, ...props }: TextFieldProps) {
  const [value, setValue] = useState(initialValue);
  return <TextField {...props} value={value} onChangeText={setValue} />;
}

FieldStory.displayName = "FieldStory";

function HiddenPasswordStory() {
  return (
    <PasswordField
      label="Пароль"
      value="wishmoon-demo"
      onChangeText={noop}
      showLabel="Показать пароль"
      hint="Не короче 8 символов"
    />
  );
}

HiddenPasswordStory.displayName = "HiddenPasswordStory";

/** The revealed state is the field's own toggle: the story presses the real button. */
function revealPassword({ canvasElement }: { canvasElement: HTMLElement }) {
  const toggle = canvasElement.querySelector<HTMLElement>("[aria-label='Показать пароль']");
  toggle?.click();
}

const meta = {
  title: "UI/TextField",
  component: TextField,
  args: {
    label: "Название желания",
    value: "",
    onChangeText: noop,
  },
  render: FieldStory,
} satisfies Meta<typeof TextField>;

export default meta;

type Story = StoryObj<typeof meta>;

export const Empty: Story = {};

export const WithText: Story = {
  args: { value: "Плед из шерсти мериноса" },
};

export const WithHint: Story = {
  args: { value: "Плед из шерсти мериноса", hint: "До 60 символов, без эмодзи" },
};

export const WithError: Story = {
  args: { value: "", error: "Название не может быть пустым" },
};

/** A stored value the form does not let change: the field keeps its text, muted. */
export const Disabled: Story = {
  args: {
    value: "Плед из шерсти мериноса",
    input: { disabled: true },
  },
};

/**
 * The focus state is the real CSS one: the story puts the caret into the field, and
 * the browser paints the `ring` border plus the 2 px ring with a 2 px offset. Click
 * the field too — a text input is always `:focus-visible` while it holds the caret.
 */
export const Focused: Story = {
  args: { value: "Плед из шерсти мериноса" },
  play: function focusInput({ canvasElement }) {
    canvasElement.querySelector<HTMLElement>("input")?.focus();
  },
};

export const Multiline: Story = {
  args: {
    label: "Описание",
    value: "Мягкий, тёплый, подходит для чтения в кресле.",
    multiline: true,
    rows: 4,
    hint: "До 500 символов",
  },
};

export const PasswordHidden: Story = {
  render: HiddenPasswordStory,
};

export const PasswordRevealed: Story = {
  render: HiddenPasswordStory,
  play: revealPassword,
};
