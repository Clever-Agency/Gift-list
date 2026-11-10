import type { Meta, StoryObj } from "@storybook/react";
import { useState, type ComponentProps } from "react";
import { YStack } from "@gift-list/ui";
import { PasswordField, TextField } from "./text-field";

/**
 * The app's labelled fields. The look and the accessibility wiring live in
 * `packages/ui` (`App/…` stories show the app wrapper: the catalogue label, the
 * error line and the `editable` → `readOnly` mapping that the screens use).
 */
const meta = {
  title: "App/TextField",
  component: TextField,
  args: {
    label: "Название",
    value: "",
    onChangeText: noop,
  },
  render: FieldStory,
} satisfies Meta<typeof TextField>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

/** The package is controlled: the story keeps what you type. */
function FieldStory({ value: initialValue, ...props }: ComponentProps<typeof TextField>) {
  const [value, setValue] = useState(initialValue);
  return <TextField {...props} value={value} onChangeText={setValue} />;
}

FieldStory.displayName = "FieldStory";

/** Empty with the placeholder the create screen passes. */
export const Empty: Story = {
  args: { input: { placeholder: "Например, наушники Sony WH-1000XM5" } },
};

/** Plain text: the wrapper's own contract is the label plus the input props. */
export const WithText: Story = {
  args: { value: "Наушники Sony WH-1000XM5" },
};

/** A hint under the field, `muted-foreground`. */
export const WithHint: Story = {
  args: { value: "250", hint: "Если не выбрать валюту, будет USD." },
};

/** An error replaces the hint, turns the border destructive and is read as an alert. */
export const WithError: Story = {
  args: { hint: "Если не выбрать валюту, будет USD.", error: "Укажите цену числом, например 250." },
};

/** `input.editable: false` becomes `readOnly`: the value is visible, not editable. */
export const ReadOnly: Story = {
  args: { value: "Плед из шерсти мериноса", input: { editable: false } },
  render: function ReadOnlyStory(args) {
    return (
      <YStack width={328}>
        <TextField {...args} />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** The password field of the auth screens: hidden text, icon-only reveal toggle. */
export const PasswordHidden: Story = {
  render: function PasswordHiddenStory() {
    return (
      <YStack width={328}>
        <PasswordField
          label="Пароль"
          value="wishmoon-demo"
          onChangeText={noop}
          showLabel="Показать пароль"
          hint="Пароль — от 8 символов"
        />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** The revealed state is the field's own toggle: the story presses the real button. */
export const PasswordRevealed: Story = {
  render: function PasswordRevealedStory() {
    return (
      <YStack width={328}>
        <PasswordField
          label="Пароль"
          value="wishmoon-demo"
          onChangeText={noop}
          showLabel="Показать пароль"
          hint="Пароль — от 8 символов"
        />
      </YStack>
    );
  },
  play: revealPassword,
  globals: { viewport: { value: "w360" } },
};

function revealPassword({ canvasElement }: { canvasElement: HTMLElement }) {
  const toggle = canvasElement.querySelector<HTMLElement>("[aria-label='Показать пароль']");
  toggle?.click();
}

/** A long Cyrillic value at 360 px: the input scrolls, the label and error wrap. */
export const LongValueNarrow: Story = {
  args: {
    label: "Ссылка (необязательно)",
    value: "https://market.example.com/наушники/sony-wh-1000xm5?color=black&case=leather",
    error: "Укажите ссылку вида https://…",
  },
  render: function LongValueNarrowStory(args) {
    return (
      <YStack width={328}>
        <TextField {...args} />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};
