import type { Meta, StoryObj } from "@storybook/react";
import { OptionField } from "./option-field";

/**
 * The shared picker of «Профиль» and «Настройки» (Story 7.2): a labelled button
 * shows the chosen value, and the `Dialog` with a `radiogroup` of `Choice` rows
 * makes the choice. With `search` the layer gets a field over the rows; without
 * `emptyLabel` the value is always set (the time zone), so there is no «not set»
 * row. The open layer is shown on Docs in its own iframe.
 */
const meta = {
  title: "App/OptionField",
  component: OptionField,
  tags: ["autodocs"],
  parameters: { docs: { story: { inline: false, iframeHeight: "860px" } } },
  globals: { viewport: { value: "w360" } },
  args: {
    label: "Страна",
    value: "BY",
    emptyLabel: "Не указана",
    options: [
      { value: "BY", label: "Беларусь" },
      { value: "KZ", label: "Казахстан" },
      { value: "RU", label: "Россия" },
    ],
    onChange: noop,
    search: {
      label: "Найти страну",
      placeholder: "Название страны",
      clearLabel: "Очистить",
      empty: "Ничего не нашли",
    },
  },
} satisfies Meta<typeof OptionField>;

export default meta;
type Story = StoryObj<typeof meta>;

function noop() {}

export const Playground: Story = {};

/** The real layer with the search field, opened by the story. */
export const Opened: Story = {
  tags: ["!dev"],
  play: openLayer,
};

/** The same at 360 px with a long zone: the row wraps instead of clipping. */
export const LongValueNarrow: Story = {
  tags: ["!dev"],
  globals: { viewport: { value: "w360" } },
  args: {
    label: "Часовой пояс",
    value: "America/Argentina/ComodRivadavia",
    emptyLabel: undefined,
    options: [
      { value: "America/Argentina/ComodRivadavia", label: "America/Argentina/ComodRivadavia (UTC−3)" },
      { value: "UTC", label: "UTC" },
    ],
  },
};

function openLayer({ canvasElement }: { canvasElement: HTMLElement }) {
  const trigger = canvasElement.querySelector<HTMLElement>("[role='button']");
  trigger?.click();
}
