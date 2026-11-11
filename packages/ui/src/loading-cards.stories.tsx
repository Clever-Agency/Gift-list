import type { Meta, StoryObj } from "@storybook/react";
import { LoadingCards } from "./loading-cards";

/**
 * `LoadingCards` is the one card-skeleton loading state of the app: a named busy
 * region (`role="status"`, `aria-busy`), not anonymous grey boxes.
 */
const meta = {
  title: "UI/LoadingCards",
  component: LoadingCards,
  args: {
    label: "Загружаем вишлист",
  },
} satisfies Meta<typeof LoadingCards>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The default three cards. */
export const Three: Story = {};

/** A single skeleton, e.g. a detail page that loads one wish. */
export const One: Story = {
  args: { count: 1 },
};

/** Six cards in the page grid at 360 px: the row wraps, nothing overflows. */
export const ManyNarrow: Story = {
  args: { count: 6, width: "100%" },
  globals: { viewport: { value: "w360" } },
};
