import type { Meta, StoryObj } from "@storybook/react";
import { AppUpdateBlockScreen } from "./app-update-block-screen";

/**
 * CLE-86: the blocking «Обновите приложение» page. It replaces the app's tree, so
 * the story frame is the screen itself (`screenFrame`). The copy comes from the
 * catalogue (`app.appVersion.block.*`), and the longest line — the body — is the
 * one the app really shows.
 *
 * Without a `storeUrl` there is no action and the body says to update in the
 * store (`bodyNoStore`); with one the screen offers «Открыть магазин».
 */
const meta = {
  title: "App/AppUpdateBlockScreen",
  component: AppUpdateBlockScreen,
  parameters: { layout: "fullscreen", screenFrame: true },
  args: {
    storeUrl: null,
    onOpenStore: noop,
  },
} satisfies Meta<typeof AppUpdateBlockScreen>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

/** No store link: the dead end agreed for the time before the stores are published. */
export const NoStore: Story = {};

/** A policy answer with a store link. */
export const WithStore: Story = {
  args: { storeUrl: "https://apps.apple.com/app/id000000000" },
};

/** The body at 360 px: it wraps under the level-1 title without clipping. */
export const Narrow: Story = {
  args: { storeUrl: "https://apps.apple.com/app/id000000000" },
  globals: { viewport: { value: "w360" } },
};
