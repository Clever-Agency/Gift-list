import type { Meta, StoryObj } from "@storybook/react";
import { useState } from "react";
import { DateField } from "./date-field";

/**
 * `DESIGN.md` → Поле даты: in the browser a real `<input type="date">` with the
 * label, an optional hint or error and a «Сбросить» button once a day is set. The
 * phone twin (`date-field.native.tsx`) is a button that opens the system picker and
 * is not rendered here. Copy is a fixture; the app passes its catalogue strings.
 * `min` is enforced by the browser; the server checks the owner's time zone.
 */
const meta = {
  title: "UI/DateField",
  component: DateField,
  args: {
    label: "Срок желания",
    value: "",
    onChange: noop,
    hint: "После этого дня желание уйдёт в архив",
    clearLabel: "Сбросить",
  },
  render: function DateFieldStory(args) {
    const [value, setValue] = useState(args.value);
    return <DateField {...args} value={value} onChange={setValue} />;
  },
} satisfies Meta<typeof DateField>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

/** No day chosen: the hint under the field, no clear button. */
export const Empty: Story = {};

/** A day is set: the «Сбросить» button appears next to the input. */
export const WithDate: Story = {
  args: { value: "2026-12-31" },
};

/** The error replaces the hint, is announced (`role="alert"`) and turns the border red. */
export const WithError: Story = {
  args: { value: "2026-01-01", error: "Дата не может быть в прошлом" },
};

/** `min` lets the browser grey out earlier days in its picker; try the calendar icon. */
export const WithMin: Story = {
  args: { min: "2026-11-19" },
};

/** Long Cyrillic label, hint and error at 360 px wrap without horizontal scroll. */
export const LongCyrillicNarrow: Story = {
  args: {
    label: "Срок, после которого желание автоматически переедет в архив владельца",
    hint: "Выберите день из календаря или оставьте поле пустым, чтобы желание не истекало",
    error: "Нельзя выбрать день, который уже прошёл в вашем часовом поясе",
    value: "2027-02-28",
  },
  globals: { viewport: { value: "w360" } },
};
