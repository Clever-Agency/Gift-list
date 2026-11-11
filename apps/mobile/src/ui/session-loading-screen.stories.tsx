import type { Meta, StoryObj } from "@storybook/react";
import { SessionLoadingScreen } from "./session-loading-screen";

/**
 * What every guarded route shows while the session is still loading: the usual
 * page frame with card skeletons, one for a form and three for a list. The region
 * name and the card width come from the screen, so no route adds its own loading
 * copy.
 */
const meta = {
  title: "App/SessionLoadingScreen",
  component: SessionLoadingScreen,
  parameters: { layout: "fullscreen", screenFrame: true },
} satisfies Meta<typeof SessionLoadingScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The wide list route: three card skeletons in the page frame. */
export const Wide: Story = {};

/** The form route: one skeleton, as wide as the field column. */
export const Form: Story = {
  args: { size: "form" },
};

/** The form route at 360 px, where the card width is the window minus the gutter. */
export const FormNarrow: Story = {
  args: { size: "form" },
  globals: { viewport: { value: "w360" } },
};

/** The list route at 360 px: the grid computes a single column. */
export const WideNarrow: Story = {
  globals: { viewport: { value: "w360" } },
};
