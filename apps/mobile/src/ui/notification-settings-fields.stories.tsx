import type { Meta, StoryObj } from "@storybook/react";
import { NotificationSettingsFields } from "./notification-settings-fields";

function noop() {}

const meta = {
  title: "App/NotificationSettings",
  component: NotificationSettingsFields,
  tags: ["autodocs"],
  parameters: { docs: { story: { inline: false, iframeHeight: "860px" } } },
  globals: { viewport: { value: "w360" } },
  args: {
    onChange: noop,
    preferences: { datesInApp: true, datesEmail: false, wishExpiryInApp: false, wishExpiryEmail: true },
  },
} satisfies Meta<typeof NotificationSettingsFields>;

export default meta;
type Story = StoryObj<typeof meta>;
export const IndependentChannels: Story = {};
export const Saving: Story = { args: { disabled: true } };
