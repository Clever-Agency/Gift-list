import type { Meta, StoryObj } from "@storybook/react";
import { YStack } from "@tamagui/stacks";
import { useEffect, useState } from "react";
import { propDoc } from "../../../.storybook/argTypes";
import { SearchField } from "./text-field";

/** The catalog copy is a fixture, not a product string (`packages/ui` has no translations). */
function noop() {}

/**
 * The search field: a magnifier, the text and the clear (×) button, all inside one
 * control. The sandbox is live: typing sticks and the × really clears the field.
 */
const meta = {
  title: "UI/SearchField",
  component: SearchField,
  tags: ["autodocs"],
  parameters: {
    docs: {
      description: {
        component: `
The search field of the app (\`DESIGN.md\` → Мелкие элементы): a magnifier on the left and a clear (×) button on the right, both in 44 × 44 touch zones inside the control, so the text never runs under them. The package is controlled: \`value\` and \`onChangeText\` belong to the caller.

What is not a prop:

- The visible name is the placeholder; \`label\` is the accessible name of the input.
- The × exists only while there is something to clear, presses with Enter and Space, and returns the focus to the input.
- The copy of the × name is \`clearLabel\`, translated by the caller.
- Hover and focus are CSS states, not props: hover the field or press Tab.
- \`maxLength\`, \`autoCapitalize\`, \`testID\` and the rest of the input go through the \`input\` bag.
        `.trim(),
      },
    },
  },
  argTypes: {
    label: propDoc({
      description: "The accessible name of the input; the visible copy is the placeholder.",
      type: "string",
      required: true,
      control: "text",
    }),
    placeholder: propDoc({
      description: "The visible prompt inside the empty field, e.g. «Имя или @ник».",
      type: "string",
      required: true,
      control: "text",
    }),
    value: propDoc({
      description:
        "The current query. The sandbox keeps it locally, so typing sticks and the control re-seeds it.",
      type: "string",
      required: true,
      control: "text",
    }),
    onChangeText: propDoc({
      description: "The new query on every keystroke; the caller owns the value and the search.",
      type: "(value: string) => void",
      required: true,
      control: false,
    }),
    clearLabel: propDoc({
      description: "The accessible name of the × button, e.g. «Очистить»; it clears the query.",
      type: "string",
      required: true,
      control: "text",
    }),
    input: propDoc({
      description:
        "The rest of the input: `maxLength`, `autoCapitalize`, `testID`, `onSubmitEditing`… The field owns the value, the id and the icons.",
      type: "TextFieldInputProps",
      control: false,
    }),
    testID: propDoc({
      description: "A stable handle for tests; reaches the web DOM as `data-testid`.",
      type: "string",
      control: "text",
    }),
  },
  args: {
    label: "Имя или @ник",
    placeholder: "Имя или @ник",
    value: "@alena",
    onChangeText: noop,
    clearLabel: "Очистить",
    testID: "search-field",
  },
} satisfies Meta<typeof SearchField>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * The sandbox: type a query and press the × — the field really clears itself.
 * `label`, `placeholder` and `clearLabel` are in the panel.
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

    return (
      <YStack width={360} maxWidth="100%">
        <SearchField {...args} value={value} onChangeText={setValue} />
      </YStack>
    );
  },
};

/** With a query: the clear button appears on the right. */
export const WithValue: Story = {
  render: function WithValueStory(args) {
    return (
      <YStack width={360} maxWidth="100%">
        <SearchField {...args} />
      </YStack>
    );
  },
};

/** Before typing: the placeholder and the magnifier, no clear button. */
export const Empty: Story = {
  tags: ["!dev"],
  args: { value: "" },
  render: function EmptyStory(args) {
    return (
      <YStack width={360} maxWidth="100%">
        <SearchField {...args} />
      </YStack>
    );
  },
};

/** A long Cyrillic name at 360 px: the text stays between the two icons. */
export const LongCyrillicNarrow: Story = {
  tags: ["!dev"],
  args: { value: "Александра-Екатерина Преображенская" },
  render: function LongCyrillicNarrowStory(args) {
    return (
      <YStack width={328}>
        <SearchField {...args} />
      </YStack>
    );
  },
  globals: { viewport: { value: "w360" } },
};

/** A server-filled or otherwise read-only field keeps its look and its clear button. */
export const ReadOnly: Story = {
  tags: ["!dev"],
  args: { value: "alena", input: { readOnly: true } },
  render: function ReadOnlyStory(args) {
    return (
      <YStack width={360} maxWidth="100%">
        <SearchField {...args} />
      </YStack>
    );
  },
};
