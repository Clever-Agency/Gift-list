import type { Meta, StoryObj } from "@storybook/react";
import { SessionErrorScreen } from "./session-error-screen";

/**
 * What a guarded route shows when the session read failed for a reason that is not
 * `UNAUTHENTICATED` — no network, a timeout or a broken answer. The region is a
 * live `alert`, because it replaces the page the user expected to see; the retry
 * belongs to the caller.
 */
const meta = {
  title: "App/SessionErrorScreen",
  component: SessionErrorScreen,
  parameters: { layout: "fullscreen", screenFrame: true },
  args: { onRetry: noop },
} satisfies Meta<typeof SessionErrorScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

/** The wide page column a list route uses. */
export const Wide: Story = {};

/** The form column: a form reads best narrow. */
export const Form: Story = {
  args: { size: "form" },
};

/** The form column at 360 px: the message and the button keep the gutter. */
export const FormNarrow: Story = {
  args: { size: "form" },
  globals: { viewport: { value: "w360" } },
};

/** A route-specific test id, as the guarded routes pass it. */
export const CustomTestId: Story = {
  args: { testID: "profile-session-error" },
};
