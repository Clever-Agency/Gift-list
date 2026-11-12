import type { Meta, StoryObj } from "@storybook/react";
import { Switch } from "./switch";

/** The catalog copy is a fixture, not a product string (`packages/ui` has no translations). */
function noop() {}

const meta = {
  title: "UI/Switch",
  component: Switch,
  args: {
    label: "Показывать друзьям",
    checked: false,
    onChange: noop,
  },
} satisfies Meta<typeof Switch>;

export default meta;

type Story = StoryObj<typeof meta>;

/** Off: the track is `$border-strong`, the thumb sits at the start. */
export const Off: Story = {};

/** On: the track is `$primary`, the thumb moves to the end. */
export const On: Story = {
  args: { checked: true },
};

/** A hint under the label; the browser reads it through `aria-describedby`. */
export const WithHint: Story = {
  args: { hint: "Этот выбор можно изменить в любой момент" },
};

/** The stored value is shown but cannot change; the row keeps its place in the focus order. */
export const Disabled: Story = {
  args: { checked: true, disabled: true },
};

/** A long Cyrillic label and hint wrap under the track instead of shrinking it. */
export const LongCyrillic: Story = {
  args: {
    label: "Не показывать меня в результатах поиска по нику и имени",
    hint: "Прямые ссылки на профиль и вишлист по-прежнему работают",
    checked: true,
  },
};

/** The narrowest supported width: the row still fits the track and wraps the text. */
export const Narrow: Story = {
  args: {
    label: "Не показывать в поиске",
    hint: "Прямые ссылки работают",
  },
  globals: { viewport: { value: "w360" } },
};
