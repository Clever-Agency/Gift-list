import type { Meta, StoryObj } from "@storybook/react";
import { AppUpdateSoftDialog } from "./app-update-soft-dialog";

/**
 * CLE-86: the dismissible «Доступно обновление» offer. The copy comes from the
 * catalogue (`app.appVersion.soft.*`), so the longest Russian line here is the
 * one the app really shows: the story does not fake a longer text.
 *
 * Without a `storeUrl` (the policy until the stores are published) the layer has
 * only «Закрыть»; with one it also has «Обновить», which opens the link. The
 * closing paths — cross, Esc, scrim, «Закрыть» — are the `Dialog`'s own.
 */
const meta = {
  title: "App/AppUpdateSoftDialog",
  component: AppUpdateSoftDialog,
  args: {
    visible: true,
    storeUrl: null,
    onOpenStore: noop,
    onDismiss: noop,
  },
} satisfies Meta<typeof AppUpdateSoftDialog>;

export default meta;

type Story = StoryObj<typeof meta>;

function noop() {}

/** No store link yet: only «Закрыть», and no address is invented. */
export const NoStore: Story = {};

/** A policy answer with a store link: «Обновить» opens it. */
export const WithStore: Story = {
  args: { storeUrl: "https://play.google.com/store/apps/details?id=example.giftlist" },
};

/** The same layer at 360 px: the copy and both actions keep the gutters. */
export const Narrow: Story = {
  args: { storeUrl: "https://play.google.com/store/apps/details?id=example.giftlist" },
  globals: { viewport: { value: "w360" } },
};
