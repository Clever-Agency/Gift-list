import type { Meta, StoryObj } from "@storybook/react";
import { NotFoundScreen } from "./not-found-screen";

/**
 * The app's one 404 page (UI6): an unknown or malformed route, never an existing
 * but closed wishlist — that state has its own neutral copy, so a hidden wishlist
 * stays indistinguishable from a missing one. The router's `Stack.Screen` only
 * sets the native header title; the catalog mocks the navigator.
 */
const meta = {
  title: "App/NotFoundScreen",
  component: NotFoundScreen,
  parameters: { layout: "fullscreen", screenFrame: true },
} satisfies Meta<typeof NotFoundScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The one 404 at any width: brand, title, one line and the link home. */
export const Default: Story = {};

/** The same page at 360 px: the copy wraps and the footer stays at the bottom. */
export const Narrow: Story = {
  globals: { viewport: { value: "w360" } },
};

/** A route-specific test id, as the guarded routes pass it. */
export const CustomTestId: Story = {
  args: { testID: "wish-route-not-found" },
};
