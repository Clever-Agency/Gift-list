import type { Meta, StoryObj } from "@storybook/react";
import { SearchField } from "./text-field";

/**
 * `DESIGN.md` → Мелкие элементы: the search field with the magnifier and the
 * clear (×) button. The copy is a fixture; the app passes its catalogue strings.
 * The clear button only exists while there is something to clear, and both icons
 * sit in 44×44 touch zones inside the control.
 */
const meta = {
  title: "UI/SearchField",
  component: SearchField,
  args: {
    label: "Имя или @ник",
    placeholder: "Имя или @ник",
    value: "",
    onChangeText: noop,
    clearLabel: "Очистить",
  },
} satisfies Meta<typeof SearchField>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

/** Before typing: the placeholder and the magnifier, no clear button. */
export const Empty: Story = {};

/** With a query: the clear button appears on the right. */
export const WithValue: Story = {
  args: { value: "@alena" },
};

/** A long Cyrillic name at 360 px: the text stays between the two icons. */
export const LongCyrillicNarrow: Story = {
  args: { value: "Александра-Екатерина Преображенская" },
  globals: { viewport: { value: "w360" } },
};

/** A server-filled or otherwise read-only field keeps its look and its clear button. */
export const ReadOnly: Story = {
  args: { value: "alena", input: { readOnly: true } },
};
