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
